import { log } from '../../utils/logger'
import { drive_v3 } from 'googleapis'
import path from 'path'
import fs from 'fs-extra'
import {
  getBiblesDir,
  getLocalBibleManifestPath,
  PersistedSyncConfig,
  BibleManifestEntry,
  BibleManifestFile,
  BIBLE_MANIFEST_SCHEMA_VERSION,
  getRemoteBibleManifestFileName,
  getRemoteBibleBlobFileName,
  MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE,
  BLOB_REUPLOAD_GRACE_MS
} from './sync.config'
import { readJsonSafe, writeJson, computeFileChecksum } from './sync.utils'
import { syncDriveOpsService } from './sync-drive-ops.service'
import { driveClientService } from './sync-drive-client.service'
import { syncProgressService } from './sync-progress.service'

export class SyncBibleService {
  async buildLocalBibleManifest(config: PersistedSyncConfig, appInstanceId: string): Promise<BibleManifestFile> {
    const userBiblesDir = getBiblesDir()
    const existing = await readJsonSafe<BibleManifestFile>(getLocalBibleManifestPath())
    const existingByName = new Map(
      (existing?.entries || []).map((entry) => [entry.fileName, entry] as const)
    )

    const entries: BibleManifestEntry[] = []

    if (await fs.pathExists(userBiblesDir)) {
      const files = await fs.readdir(userBiblesDir)
      for (const fileName of files) {
        if (!fileName.endsWith('.ebbl')) continue

        const fullPath = path.join(userBiblesDir, fileName)
        const stats = await fs.stat(fullPath)
        if (!stats.isFile()) continue

        const previous = existingByName.get(fileName)
        const canReuseChecksum =
          !!previous && !previous.deletedAt && previous.size === stats.size && previous.mtime === stats.mtimeMs
        const checksum = canReuseChecksum ? previous.checksum : await computeFileChecksum(fullPath)

        entries.push({
          fileName,
          size: stats.size,
          checksum,
          mtime: stats.mtimeMs,
          deletedAt: null,
          lastSyncedAt: previous?.lastSyncedAt || null,
          driveFileId: canReuseChecksum ? previous?.driveFileId || null : null
        })
      }
    }

    return {
      schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: new Date().toISOString(),
      entries
    }
  }

  async readRemoteBibleManifest(drive: drive_v3.Drive, workspaceId: string): Promise<BibleManifestFile | null> {
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const fileName = getRemoteBibleManifestFileName(workspaceId)
    const metadata = await syncDriveOpsService.findFileByName(drive, folderId, fileName)
    if (!metadata?.id) return null

    const parsed = await syncDriveOpsService.downloadJsonFile<BibleManifestFile>(drive, metadata.id)
    if (!parsed || parsed.schemaVersion !== BIBLE_MANIFEST_SCHEMA_VERSION || parsed.workspaceId !== workspaceId) return null
    return parsed
  }

  async writeRemoteBibleManifest(drive: drive_v3.Drive, workspaceId: string, manifest: BibleManifestFile) {
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const fileName = getRemoteBibleManifestFileName(workspaceId)
    await syncDriveOpsService.upsertFile(drive, folderId, fileName, manifest)
  }

  private async listRemoteBibleBlobs(drive: drive_v3.Drive, workspaceId: string) {
    const prefix = `${getRemoteBibleBlobFileName(workspaceId, '').slice(0, -64 - '.bin'.length)}`
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    return syncDriveOpsService.listFilesByPrefix(drive, folderId, prefix, '.bin')
  }

  private async uploadBibleBlob(drive: drive_v3.Drive, workspaceId: string, entry: BibleManifestEntry) {
    const fullPath = path.join(getBiblesDir(), entry.fileName)
    const fileName = getRemoteBibleBlobFileName(workspaceId, entry.checksum)
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    return syncDriveOpsService.uploadBlob(drive, folderId, fileName, fullPath)
  }

  private async downloadBibleBlobToLocal(drive: drive_v3.Drive, fileId: string, fileName: string, expectedChecksum?: string) {
    const destination = path.join(getBiblesDir(), fileName)
    await syncDriveOpsService.downloadFileToDisk(drive, fileId, destination, { expectedChecksum })
  }

  async syncBibleFiles(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    mode: 'push' | 'pull',
    appInstanceId: string
  ) {
    syncProgressService.setMessage(`Iniciando sync de biblias (${mode})...`)
    log.warn(`[sync] Iniciando sync de biblias (${mode})`)

    const localManifest = await this.buildLocalBibleManifest(config, appInstanceId)
    log.warn(`[sync] Manifiesto local de biblias: ${localManifest.entries.length} entradas`)

    if (localManifest.entries.length === 0 && mode === 'push') {
      return { uploaded: 0, downloaded: 0 }
    }

    const remoteManifest = (await this.readRemoteBibleManifest(drive, config.workspaceId)) || {
      schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: new Date().toISOString(),
      entries: []
    }

    const localByName = new Map(localManifest.entries.map((entry) => [entry.fileName, entry] as const))
    const remoteByName = new Map(remoteManifest.entries.map((entry) => [entry.fileName, entry] as const))

    const remoteBlobByChecksum = new Map<string, string>()
    const checksumsSinFileId = new Set<string>()

    for (const remoteEntry of remoteManifest.entries) {
      if (remoteEntry.deletedAt) continue
      if (remoteEntry.driveFileId) {
        remoteBlobByChecksum.set(remoteEntry.checksum, remoteEntry.driveFileId)
      } else {
        checksumsSinFileId.add(remoteEntry.checksum)
      }
    }

    if (checksumsSinFileId.size > 0) {
      const blobsBySearch = await this.listRemoteBibleBlobs(drive, config.workspaceId)
      for (const checksum of checksumsSinFileId) {
        const fileId = blobsBySearch.get(checksum)
        if (fileId) remoteBlobByChecksum.set(checksum, fileId)
      }
    }

    let uploaded = 0
    let downloaded = 0
    let driveFileIdVerifications = 0
    const nowIso = new Date().toISOString()
    const nowMs = Date.now()

    if (mode === 'push') {
      syncProgressService.setMessage(`Subiendo ${localManifest.entries.length} biblias...`)
      for (const [index, localEntry] of localManifest.entries.entries()) {
        if (index % 5 === 0 && index > 0) {
          syncProgressService.setMessage(`Biblias: ${index}/${localManifest.entries.length}...`)
        }
        if (localEntry.deletedAt) {
          remoteByName.set(localEntry.fileName, { ...localEntry, lastSyncedAt: nowIso })
          localByName.set(localEntry.fileName, { ...localEntry, lastSyncedAt: nowIso })
          continue
        }

        const remoteEntry = remoteByName.get(localEntry.fileName)
        let hasRemoteBlob = remoteBlobByChecksum.has(localEntry.checksum)

        if (!hasRemoteBlob && localEntry.driveFileId) {
          remoteBlobByChecksum.set(localEntry.checksum, localEntry.driveFileId)
          hasRemoteBlob = true
        }

        if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt && hasRemoteBlob) {
          let resolvedFileId = localEntry.driveFileId || remoteEntry.driveFileId || remoteBlobByChecksum.get(localEntry.checksum) || null

          if (resolvedFileId && remoteEntry.driveFileId === resolvedFileId && driveFileIdVerifications < MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE) {
            driveFileIdVerifications++
            const exists = await syncDriveOpsService.remoteFileIdExists(drive, resolvedFileId)
            if (!exists) {
              hasRemoteBlob = false
              remoteBlobByChecksum.delete(localEntry.checksum)
              resolvedFileId = null
              remoteByName.set(localEntry.fileName, { ...remoteEntry, driveFileId: null })
            }
          }

          if (hasRemoteBlob && resolvedFileId) {
            if (!remoteEntry.driveFileId) remoteByName.set(localEntry.fileName, { ...remoteEntry, driveFileId: resolvedFileId })
            if (!localEntry.driveFileId) localByName.set(localEntry.fileName, { ...localEntry, driveFileId: resolvedFileId })
            continue
          }
        }

        if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt && !hasRemoteBlob) {
          const lastSyncedAt = localEntry.lastSyncedAt || remoteEntry.lastSyncedAt
          if (lastSyncedAt && (nowMs - Date.parse(lastSyncedAt)) < BLOB_REUPLOAD_GRACE_MS) continue
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) {
          try {
            const fileId = await this.uploadBibleBlob(drive, config.workspaceId, localEntry)
            remoteBlobByChecksum.set(localEntry.checksum, fileId)
            localEntry.driveFileId = fileId
          } catch (err) {
            log.error(`[sync] Error subiendo blob de biblia para ${localEntry.fileName}:`, err instanceof Error ? err.message : err)
            continue
          }
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) continue

        uploaded++
        localByName.set(localEntry.fileName, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
        remoteByName.set(localEntry.fileName, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
      }

      await this.writeRemoteBibleManifest(drive, config.workspaceId, {
        schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
        workspaceId: config.workspaceId,
        deviceId: appInstanceId,
        updatedAt: nowIso,
        entries: Array.from(remoteByName.values()).sort((a, b) => a.fileName.localeCompare(b.fileName))
      })
    }

    if (mode === 'pull') {
      syncProgressService.setMessage(`Descargando ${remoteManifest.entries.length} biblias...`)
      for (const [index, remoteEntry] of remoteManifest.entries.entries()) {
        if (index % 5 === 0 && index > 0) {
          syncProgressService.setMessage(`Biblias: ${index}/${remoteManifest.entries.length}...`)
        }
        if (remoteEntry.deletedAt) {
          const localFullPath = path.join(getBiblesDir(), remoteEntry.fileName)
          if (await fs.pathExists(localFullPath)) await fs.remove(localFullPath)
          localByName.set(remoteEntry.fileName, { ...remoteEntry, lastSyncedAt: nowIso })
          continue
        }

        const localEntry = localByName.get(remoteEntry.fileName)
        if (localEntry?.checksum === remoteEntry.checksum && !localEntry.deletedAt) continue

        const remoteFileId = remoteBlobByChecksum.get(remoteEntry.checksum)
        if (!remoteFileId) continue

        try {
          await this.downloadBibleBlobToLocal(drive, remoteFileId, remoteEntry.fileName, remoteEntry.checksum)
        } catch (err) {
          log.warn(`[sync] Error descargando biblia ${remoteEntry.fileName}:`, err instanceof Error ? err.message : err)
          continue
        }
        downloaded++
        localByName.set(remoteEntry.fileName, { ...remoteEntry, deletedAt: null, lastSyncedAt: nowIso })
      }
    }

    await writeJson(getLocalBibleManifestPath(), {
      schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: nowIso,
      entries: Array.from(localByName.values()).sort((a, b) => a.fileName.localeCompare(b.fileName))
    })

    return { uploaded, downloaded }
  }
}

export const syncBibleService = new SyncBibleService()
