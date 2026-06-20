import { log } from '../../utils/logger'
import path from 'path'
import fs from 'fs-extra'
import { getMediaDir, PersistedSyncConfig, SyncDiagnostic, SyncDiagnosticEntry, MediaManifestEntry } from './sync.config'
import { syncMediaService } from './sync-media.service'
import { computeFileChecksum } from './sync.utils'

export class SyncDiagnosticService {
  async diagnoseSyncIssues(
    drive: ReturnType<typeof import('googleapis').google.drive>,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ): Promise<SyncDiagnostic> {
    const userMediaBase = getMediaDir()

    const localManifest = await syncMediaService.buildLocalMediaManifest(config, appInstanceId)
    const remoteManifest =
      (await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)) || { entries: [] }

    const remoteBlobByChecksum = new Map<string, string>()
    const checksumsSinFileId = new Set<string>()

    for (const entry of (remoteManifest as any).entries || []) {
      if (entry.driveFileId) {
        remoteBlobByChecksum.set(entry.checksum, entry.driveFileId)
      } else if (!entry.deletedAt) {
        checksumsSinFileId.add(entry.checksum)
      }
    }

    if (checksumsSinFileId.size > 0) {
      const bySearch = await syncMediaService.listRemoteMediaBlobs(drive, config.workspaceId, folderId)
      for (const checksum of checksumsSinFileId) {
        const fileId = bySearch.get(checksum)
        if (fileId) remoteBlobByChecksum.set(checksum, fileId)
      }
    }

    const localByPath = new Map(localManifest.entries.map((e) => [e.path, e]))
    const remoteEntries: MediaManifestEntry[] = (remoteManifest as any)?.entries || []
    const remoteByPath = new Map(remoteEntries.map((e) => [e.path, e]))

    const allPaths = new Set<string>()
    for (const p of localManifest.entries) allPaths.add(p.path)
    for (const p of remoteEntries) allPaths.add(p.path)

    const details: SyncDiagnosticEntry[] = []

    for (const filePath of allPaths) {
      const local = localByPath.get(filePath)
      const remote = remoteByPath.get(filePath)

      const localFileOnDisk = local
        ? await fs.pathExists(path.join(userMediaBase, local.path))
        : false

      const isTombstone = !!(local?.deletedAt || remote?.deletedAt)
      const localChecksum = local?.checksum || null
      const remoteChecksum = remote?.checksum || null
      const remoteBlobExists = remoteChecksum ? remoteBlobByChecksum.has(remoteChecksum) : false

      let issue: SyncDiagnosticEntry['issue'] = 'ok'

      if (isTombstone) {
        issue = 'tombstoned'
      } else if (local && !localFileOnDisk && !remote) {
        issue = 'orphan-local'
      } else if (local && !localFileOnDisk && remote && remoteBlobExists) {
        issue = 'missing-locally'
      } else if (remote && !remoteBlobExists) {
        issue = 'missing-in-drive'
      } else if (local && !localFileOnDisk && remote && !remoteBlobExists) {
        issue = 'missing-in-drive'
      } else if (local && !localFileOnDisk && !remote) {
        issue = 'orphan-local'
      }

      details.push({
        path: filePath,
        size: local?.size || remote?.size || 0,
        localChecksum,
        remoteChecksum,
        localExists: localFileOnDisk,
        remoteBlobExists,
        isTombstone,
        issue
      })
    }

    const summary = {
      total: details.length,
      ok: details.filter((d) => d.issue === 'ok').length,
      needUpload: details.filter((d) => d.issue === 'missing-in-drive').length,
      needDownload: details.filter((d) => d.issue === 'missing-locally').length,
      orphanLocal: details.filter((d) => d.issue === 'orphan-local').length,
      tombstoned: details.filter((d) => d.issue === 'tombstoned').length,
      totalSizeBytes: details.reduce((acc, d) => acc + d.size, 0)
    }

    return {
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      fetchedAt: new Date().toISOString(),
      summary,
      details
    }
  }

  async healSyncIssues(
    drive: ReturnType<typeof import('googleapis').google.drive>,
    diagnostic: SyncDiagnostic,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ): Promise<{
    uploaded: number
    downloaded: number
    errors: Array<{ path: string; error: string }>
  }> {
    const userMediaBase = getMediaDir()
    const nowIso = new Date().toISOString()
    let uploaded = 0
    let downloaded = 0
    const errors: Array<{ path: string; error: string }> = []

    const toUpload = diagnostic.details.filter((d) => d.issue === 'missing-in-drive')
    for (const entry of toUpload) {
      const fullPath = path.join(userMediaBase, entry.path)
      if (!(await fs.pathExists(fullPath))) {
        errors.push({ path: entry.path, error: 'Archivo local no encontrado para subir' })
        continue
      }
      try {
        const localEntry = {
          path: entry.path,
          size: entry.size,
          checksum: entry.localChecksum || (await computeFileChecksum(fullPath)),
          mtime: (await fs.stat(fullPath)).mtimeMs,
          deletedAt: null,
          lastSyncedAt: null,
          driveFileId: null
        }
        await syncMediaService.uploadMediaBlob(drive, config.workspaceId, localEntry, folderId)
        uploaded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        errors.push({ path: entry.path, error: msg })
        log.error(`[heal] Error subiendo ${entry.path}:`, msg)
      }
    }

    const remoteManifest = await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)
    const remoteByChecksum = new Map<string, { path: string; fileId: string }>()

    if (remoteManifest) {
      for (const re of remoteManifest.entries) {
        if (re.deletedAt) continue
        const fileId = re.driveFileId || null
        if (fileId) remoteByChecksum.set(re.checksum, { path: re.path, fileId })
      }
      const blobsBySearch = await syncMediaService.listRemoteMediaBlobs(drive, config.workspaceId, folderId)
      for (const re of remoteManifest.entries) {
        if (re.deletedAt) continue
        if (!remoteByChecksum.has(re.checksum)) {
          const fileId = blobsBySearch.get(re.checksum)
          if (fileId) remoteByChecksum.set(re.checksum, { path: re.path, fileId })
        }
      }
    }

    const toDownload = diagnostic.details.filter((d) => d.issue === 'missing-locally')
    for (const entry of toDownload) {
      const remoteChecksum = entry.remoteChecksum
      if (!remoteChecksum) {
        errors.push({ path: entry.path, error: 'Sin checksum remoto' })
        continue
      }
      const blobInfo = remoteByChecksum.get(remoteChecksum)
      if (!blobInfo) {
        errors.push({ path: entry.path, error: 'Blob remoto no encontrado en Drive' })
        continue
      }
      try {
        await syncMediaService.downloadAndVerifyBlobChecksum(drive, blobInfo.fileId, entry.path, remoteChecksum)
        downloaded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        errors.push({ path: entry.path, error: msg })
        log.error(`[heal] Error descargando ${entry.path}:`, msg)
      }
    }

    const updatedLocalManifest = await syncMediaService.buildLocalMediaManifest(config, appInstanceId)
    const { writeJson } = await import('./sync.utils')
    const { getLocalMediaManifestPath } = await import('./sync.config')
    await writeJson(getLocalMediaManifestPath(), updatedLocalManifest)

    if (uploaded > 0) {
      const localManifest = await syncMediaService.buildLocalMediaManifest(config, appInstanceId)
      const currentRemoteManifest =
        (await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)) || {
          schemaVersion: 1,
          workspaceId: config.workspaceId,
          deviceId: appInstanceId,
          updatedAt: nowIso,
          entries: []
        }

      const mergedByPath = new Map<string, MediaManifestEntry>(
        (currentRemoteManifest as any).entries?.map((e: MediaManifestEntry) => [e.path, e]) || []
      )
      for (const localEntry of localManifest.entries) {
        const existing = mergedByPath.get(localEntry.path)
        mergedByPath.set(localEntry.path, {
          ...localEntry,
          driveFileId: localEntry.driveFileId || existing?.driveFileId || null,
          lastSyncedAt: nowIso
        })
      }

      await syncMediaService.writeRemoteMediaManifest(drive, config.workspaceId, {
        schemaVersion: 1,
        workspaceId: config.workspaceId,
        deviceId: appInstanceId,
        updatedAt: nowIso,
        entries: Array.from(mergedByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
      }, folderId)
    }

    return { uploaded, downloaded, errors }
  }
}

export const syncDiagnosticService = new SyncDiagnosticService()
