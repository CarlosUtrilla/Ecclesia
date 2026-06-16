import { drive_v3 } from 'googleapis'
import path from 'path'
import fs from 'fs-extra'
import { getBiblesDir, getLocalBibleManifestPath, PersistedSyncConfig, BibleManifestEntry, BibleManifestFile, BIBLE_MANIFEST_SCHEMA_VERSION, getRemoteBibleManifestFileName, getRemoteBibleBlobFileName, MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE, BLOB_REUPLOAD_GRACE_MS } from './sync.config'
import { readJsonSafe, writeJson, computeFileChecksum, streamToString } from './sync.utils'

export class SyncBibleService {
  async buildLocalBibleManifest(
    config: PersistedSyncConfig,
    appInstanceId: string
  ): Promise<BibleManifestFile> {
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

  private async getRemoteBibleManifestMetadata(drive: drive_v3.Drive, workspaceId: string) {
    const fileName = getRemoteBibleManifestFileName(workspaceId)
    const { DriveClientService } = await import('./sync-drive-client.service')
    const driveClientService = new DriveClientService()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const result = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 1,
      orderBy: 'modifiedTime desc'
    })
    return result.data.files?.[0]
  }

  async readRemoteBibleManifest(
    drive: drive_v3.Drive,
    workspaceId: string
  ): Promise<BibleManifestFile | null> {
    const metadata = await this.getRemoteBibleManifestMetadata(drive, workspaceId)
    if (!metadata?.id) return null

    const response = await drive.files.get(
      { fileId: metadata.id, alt: 'media' },
      { responseType: 'stream' }
    )
    const raw = await streamToString(response.data as NodeJS.ReadableStream)
    try {
      const parsed = JSON.parse(raw)
      if (
        !parsed || parsed.schemaVersion !== BIBLE_MANIFEST_SCHEMA_VERSION ||
        parsed.workspaceId !== workspaceId
      ) return null
      return parsed as BibleManifestFile
    } catch {
      return null
    }
  }

  async writeRemoteBibleManifest(
    drive: drive_v3.Drive,
    workspaceId: string,
    manifest: BibleManifestFile
  ) {
    const fileName = getRemoteBibleManifestFileName(workspaceId)
    const existing = await this.getRemoteBibleManifestMetadata(drive, workspaceId)
    const media = { mimeType: 'application/json', body: JSON.stringify(manifest) }

    if (existing?.id) {
      await drive.files.update({ fileId: existing.id, media, fields: 'id' })
      return
    }

    const { DriveClientService } = await import('./sync-drive-client.service')
    const driveClientService = new DriveClientService()
    await drive.files.create({
      requestBody: { name: fileName, parents: [await driveClientService.getOrCreateEcclesiaFolder(drive)] },
      media,
      fields: 'id'
    })
  }

  private async listRemoteBibleBlobs(drive: drive_v3.Drive, workspaceId: string) {
    const prefix = `${getRemoteBibleBlobFileName(workspaceId, '').slice(0, -64 - '.bin'.length)}`
    const { DriveClientService } = await import('./sync-drive-client.service')
    const driveClientService = new DriveClientService()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const byChecksum = new Map<string, string>()

    let pageToken: string | undefined
    do {
      const result = await drive.files.list({
        q: `name contains '${prefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken
      })

      for (const file of result.data.files || []) {
        const name = file.name || ''
        if (!name.startsWith(prefix) || !name.endsWith('.bin') || !file.id) continue
        const checksum = name.slice(prefix.length, -'.bin'.length)
        if (checksum) byChecksum.set(checksum, file.id)
      }
      pageToken = result.data.nextPageToken || undefined
    } while (pageToken)

    return byChecksum
  }

  private async uploadBibleBlob(
    drive: drive_v3.Drive,
    workspaceId: string,
    entry: BibleManifestEntry
  ) {
    const fullPath = path.join(getBiblesDir(), entry.fileName)
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`Archivo de biblia no encontrado: ${entry.fileName}`)
    }

    const fileName = getRemoteBibleBlobFileName(workspaceId, entry.checksum)
    const { DriveClientService } = await import('./sync-drive-client.service')
    const driveClientService = new DriveClientService()
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [await driveClientService.getOrCreateEcclesiaFolder(drive)] },
      media: { mimeType: 'application/octet-stream', body: fs.createReadStream(fullPath) },
      fields: 'id'
    })

    const fileId = created.data.id || ''
    if (!fileId) {
      throw new Error(`[sync] Drive no devolvió fileId para blob de biblia: ${entry.fileName}`)
    }
    return fileId
  }

  private async downloadBibleBlobToLocal(drive: drive_v3.Drive, fileId: string, fileName: string) {
    const destination = path.join(getBiblesDir(), fileName)
    await fs.ensureDir(path.dirname(destination))

    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(destination)
      ;(response.data as NodeJS.ReadableStream).pipe(writer)
      writer.on('finish', () => resolve())
      writer.on('error', reject)
    })
  }

  private async remoteFileIdExists(drive: drive_v3.Drive, fileId: string): Promise<boolean> {
    try {
      await drive.files.get({ fileId, fields: 'id' })
      return true
    } catch {
      return false
    }
  }

  async syncBibleFiles(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    mode: 'push' | 'pull',
    appInstanceId: string
  ) {
    const localManifest = await this.buildLocalBibleManifest(config, appInstanceId)
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
      for (const localEntry of localManifest.entries) {
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
            const exists = await this.remoteFileIdExists(drive, resolvedFileId)
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
            console.error(`[sync] Error subiendo blob de biblia para ${localEntry.fileName}:`, err instanceof Error ? err.message : err)
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
      for (const remoteEntry of remoteManifest.entries) {
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
          await this.downloadBibleBlobToLocal(drive, remoteFileId, remoteEntry.fileName)
        } catch (err) {
          console.warn(`[sync] Error descargando biblia ${remoteEntry.fileName}:`, err instanceof Error ? err.message : err)
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
