import log from 'electron-log'
import { drive_v3 } from 'googleapis'
import path from 'path'
import fs from 'fs-extra'
import { getPrisma } from '../../prisma'
import { getMediaDir, getLocalMediaManifestPath } from './sync.config'
import {
  MEDIA_MANIFEST_SCHEMA_VERSION,
  MediaManifestEntry,
  MediaManifestFile,
  PersistedSyncConfig,
  REMOTE_MEDIA_BLOB_FILE_PREFIX,
  getRemoteMediaManifestFileName,
  getRemoteMediaBlobFileName,
  toSafeFileSegment,
  BLOB_REUPLOAD_GRACE_MS,
  MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE,
  BLOB_UPLOAD_CONCURRENCY
} from './sync.config'
import { readJsonSafe, writeJson, computeFileChecksum } from './sync.utils'
import { withTimeout } from './sync.utils'
import { syncDriveOpsService } from './sync-drive-ops.service'
import { syncProgressService } from './sync-progress.service'

export class SyncMediaService {
  async buildLocalMediaManifest(
    config: PersistedSyncConfig,
    appInstanceId: string
  ): Promise<MediaManifestFile> {
    const prisma = getPrisma()
    const existing = await readJsonSafe<MediaManifestFile>(getLocalMediaManifestPath())
    const existingByPath = new Map(
      (existing?.entries || []).map((entry) => [entry.path, entry] as const)
    )

    const mediaRows = await prisma.media.findMany({
      where: { deletedAt: null },
      select: { filePath: true, thumbnail: true, fallback: true }
    })

    const fontRows =
      prisma && (prisma as any).font && typeof (prisma as any).font.findMany === 'function'
        ? await (prisma as any).font.findMany({
            where: { deletedAt: null },
            select: { filePath: true }
          })
        : []

    const relativePathsSet = new Set<string>()
    for (const row of mediaRows) {
      if (row.filePath) relativePathsSet.add(row.filePath)
      if (row.thumbnail) relativePathsSet.add(row.thumbnail)
      if (row.fallback) relativePathsSet.add(row.fallback)
    }
    for (const row of fontRows) {
      if (row.filePath) relativePathsSet.add(row.filePath)
    }

    const nextEntriesMap = new Map<string, MediaManifestEntry>()
    const userMediaBase = getMediaDir()

    for (const relativePath of relativePathsSet) {
      const fullPath = path.join(userMediaBase, relativePath)
      if (!(await fs.pathExists(fullPath))) {
        const previous = existingByPath.get(relativePath)
        if (previous) {
          nextEntriesMap.set(relativePath, {
            ...previous,
            deletedAt: previous.deletedAt || new Date().toISOString()
          })
        }
        continue
      }

      const stats = await fs.stat(fullPath)
      if (!stats.isFile()) continue

      const previous = existingByPath.get(relativePath)
      const canReuseChecksum =
        !!previous &&
        !previous.deletedAt &&
        previous.size === stats.size &&
        previous.mtime === stats.mtimeMs
      const checksum = canReuseChecksum
        ? previous.checksum
        : await computeFileChecksum(fullPath)

      // Reuse driveFileId if content didn't change: either fast path (size+mtime match)
      // or size matches and new checksum equals previous checksum.
      const canReuseDriveFileId =
        !!previous &&
        !previous.deletedAt &&
        previous.size === stats.size &&
        (previous.mtime === stats.mtimeMs || checksum === previous.checksum)

      if (!canReuseDriveFileId && previous?.driveFileId) {
        log.warn(`[sync] PERDIENDO driveFileId para ${relativePath}: prevDriveFileId=${previous.driveFileId}, sizeMatch=${previous.size === stats.size}, mtimeMatch=${previous.mtime === stats.mtimeMs}`)
      }

      nextEntriesMap.set(relativePath, {
        path: relativePath,
        size: stats.size,
        checksum,
        mtime: stats.mtimeMs,
        deletedAt: null,
        lastSyncedAt: previous?.lastSyncedAt || null,
        driveFileId: canReuseDriveFileId ? previous?.driveFileId || null : null
      })
    }

    for (const [relativePath, previous] of existingByPath) {
      if (nextEntriesMap.has(relativePath)) continue
      const orphanFullPath = path.join(userMediaBase, relativePath)
      if (await fs.pathExists(orphanFullPath)) {
        nextEntriesMap.set(relativePath, previous)
      } else {
        nextEntriesMap.set(relativePath, {
          ...previous,
          deletedAt: previous.deletedAt || new Date().toISOString()
        })
      }
    }

    return {
      schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: new Date().toISOString(),
      entries: Array.from(nextEntriesMap.values()).sort((a, b) => a.path.localeCompare(b.path))
    }
  }

  async readRemoteMediaManifest(
    drive: drive_v3.Drive,
    workspaceId: string,
    folderId: string
  ): Promise<MediaManifestFile | null> {
    const fileName = getRemoteMediaManifestFileName(workspaceId)
    const metadata = await syncDriveOpsService.findFileByName(drive, folderId, fileName)
    if (!metadata?.id) return null

    const parsed = await syncDriveOpsService.downloadJsonFile<MediaManifestFile>(drive, metadata.id)
    if (!parsed || parsed.schemaVersion !== MEDIA_MANIFEST_SCHEMA_VERSION || parsed.workspaceId !== workspaceId) return null
    return parsed
  }

  async writeRemoteMediaManifest(
    drive: drive_v3.Drive,
    workspaceId: string,
    manifest: MediaManifestFile,
    folderId: string
  ) {
    const fileName = getRemoteMediaManifestFileName(workspaceId)
    await syncDriveOpsService.upsertFile(drive, folderId, fileName, manifest)
  }

  async listRemoteMediaBlobs(
    drive: drive_v3.Drive,
    workspaceId: string,
    folderId: string
  ): Promise<Map<string, string>> {
    const basePrefix = `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-`
    const result = await syncDriveOpsService.listFilesByPrefix(drive, folderId, basePrefix, '.bin')
    log.warn(`[sync] listRemoteMediaBlobs: basePrefix="${basePrefix}", encontrados=${result.size}`)
    return result
  }

  async uploadMediaBlob(
    drive: drive_v3.Drive,
    workspaceId: string,
    entry: MediaManifestEntry,
    folderId: string
  ): Promise<string> {
    const fullPath = path.join(getMediaDir(), entry.path)
    const fileName = getRemoteMediaBlobFileName(workspaceId, entry.checksum)
    return syncDriveOpsService.uploadBlob(drive, folderId, fileName, fullPath)
  }

  async downloadAndVerifyBlobChecksum(
    drive: drive_v3.Drive,
    fileId: string,
    relativePath: string,
    expectedChecksum: string
  ): Promise<string> {
    const destination = path.join(getMediaDir(), relativePath)
    return syncDriveOpsService.downloadFileToDisk(drive, fileId, destination, { expectedChecksum })
  }

  async syncMediaManifest(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    mode: 'push' | 'pull',
    appInstanceId: string,
    folderId: string
  ) {
    syncProgressService.setMessage(`Construyendo manifiesto local de medios (${mode})...`)
    log.warn(`[sync] Iniciando sync de medios (${mode})`)
    const localManifest = await this.buildLocalMediaManifest(config, appInstanceId)
    log.warn(`[sync] Manifiesto local: ${localManifest.entries.length} entradas`)
    const remoteManifest =
      (await this.readRemoteMediaManifest(drive, config.workspaceId, folderId)) || {
        schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
        workspaceId: config.workspaceId,
        deviceId: appInstanceId,
        updatedAt: new Date().toISOString(),
        entries: []
      }

    const localByPath = new Map(localManifest.entries.map((e) => [e.path, e] as const))
    const remoteByPath = new Map(remoteManifest.entries.map((e) => [e.path, e] as const))
    const remoteBlobByChecksum = new Map<string, string>()
    const checksumsSinFileId = new Set<string>()

    for (const re of remoteManifest.entries) {
      if (re.driveFileId) remoteBlobByChecksum.set(re.checksum, re.driveFileId)
      else if (!re.deletedAt) checksumsSinFileId.add(re.checksum)
    }

    if (checksumsSinFileId.size > 0) {
      log.warn(`[sync] Resolviendo ${checksumsSinFileId.size} checksums sin driveFileId en manifest remoto`)
      const bySearch = await this.listRemoteMediaBlobs(drive, config.workspaceId, folderId)
      let resueltos = 0
      for (const c of checksumsSinFileId) {
        const fid = bySearch.get(c)
        if (fid) { remoteBlobByChecksum.set(c, fid); resueltos++ }
      }
      log.warn(`[sync] Checksums sin fileId: ${checksumsSinFileId.size}, resueltos por nombre: ${resueltos}`)
    }

    let uploaded = 0
    let downloaded = 0
    let missingRemoteBlobs = 0
    let driveFileIdVerifications = 0
    const BLOB_UPLOAD_TIMEOUT_MS = 600_000
    const nowIso = new Date().toISOString()
    const nowMs = Date.now()

    if (mode === 'push') {
      const pendingUploads: MediaManifestEntry[] = []

      syncProgressService.setMessage(`Sincronizando ${localManifest.entries.length} archivos de medios (push)...`)
      for (const [index, localEntry] of localManifest.entries.entries()) {
        if (index % 20 === 0 && index > 0) {
          syncProgressService.setMessage(`Procesando medios: ${index}/${localManifest.entries.length}...`)
        }
        if (localEntry.deletedAt) {
          const remoteEntry = remoteByPath.get(localEntry.path)
          let shouldClear = false
          const blobFileId =
            localEntry.driveFileId ||
            remoteEntry?.driveFileId ||
            (localEntry.checksum ? remoteBlobByChecksum.get(localEntry.checksum) : undefined)

          if (blobFileId) {
            try {
              await drive.files.delete({ fileId: blobFileId })
              shouldClear = true
              if (localEntry.checksum) remoteBlobByChecksum.delete(localEntry.checksum)
            } catch (err) {
              if (syncDriveOpsService.isDriveNotFoundError(err)) {
                shouldClear = true
                if (localEntry.checksum) remoteBlobByChecksum.delete(localEntry.checksum)
              } else { log.warn(`[sync] No se pudo eliminar blob de Drive para ${localEntry.path}:`, err) }
            }
          }

          remoteByPath.set(localEntry.path, { ...localEntry, lastSyncedAt: nowIso, driveFileId: shouldClear ? null : localEntry.driveFileId || remoteEntry?.driveFileId || null })
          localByPath.set(localEntry.path, { ...localEntry, lastSyncedAt: nowIso, driveFileId: shouldClear ? null : localEntry.driveFileId || remoteEntry?.driveFileId || null })
          continue
        }

        const remoteEntry = remoteByPath.get(localEntry.path)
        let hasRemoteBlob = remoteBlobByChecksum.has(localEntry.checksum)

        if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt && hasRemoteBlob) {
          let resolvedFileId = localEntry.driveFileId || remoteEntry.driveFileId || remoteBlobByChecksum.get(localEntry.checksum) || null

          if (resolvedFileId && driveFileIdVerifications < MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE) {
            driveFileIdVerifications++
            const exists = await syncDriveOpsService.remoteFileIdExists(drive, resolvedFileId)
            if (!exists) {
              log.warn(`[sync] VERIFICACION FALLIDA para ${localEntry.path}: fileId=${resolvedFileId} no existe en Drive`)
              hasRemoteBlob = false
              remoteBlobByChecksum.delete(localEntry.checksum)
              resolvedFileId = null
              remoteByPath.set(localEntry.path, { ...remoteEntry, driveFileId: null })
            }
          }

          if (hasRemoteBlob && resolvedFileId) {
            if (!remoteEntry.driveFileId) remoteByPath.set(localEntry.path, { ...remoteEntry, driveFileId: resolvedFileId })
            if (!localEntry.driveFileId) localByPath.set(localEntry.path, { ...localEntry, driveFileId: resolvedFileId })
            continue
          }
        }

        if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt && !hasRemoteBlob) {
          log.warn(`[sync] CHECKSUM MATCH SIN BLOB: path=${localEntry.path}, remoteDriveFileId=${remoteEntry.driveFileId}, localDriveFileId=${localEntry.driveFileId}`)
          if (remoteEntry.driveFileId) {
            try {
              await this.downloadAndVerifyBlobChecksum(drive, remoteEntry.driveFileId, remoteEntry.path, remoteEntry.checksum)
              remoteBlobByChecksum.set(remoteEntry.checksum, remoteEntry.driveFileId)
              hasRemoteBlob = true
              continue
            } catch {
              if (syncDriveOpsService.isDriveNotFoundError(remoteEntry.driveFileId)) {
                log.warn(`[sync] BLOB NO ENCONTRADO en Drive para ${remoteEntry.path}, limpiando driveFileId`)
                remoteByPath.set(remoteEntry.path, { ...remoteEntry, driveFileId: null })
                hasRemoteBlob = false
              }
            }
          }

          if (!hasRemoteBlob) {
            const lastSyncedAt = localEntry.lastSyncedAt || remoteEntry.lastSyncedAt
            if (lastSyncedAt && (nowMs - Date.parse(lastSyncedAt)) < BLOB_REUPLOAD_GRACE_MS) {
              log.warn(`[sync] SALTANDO por grace window: path=${localEntry.path}, graceMs=${nowMs - Date.parse(lastSyncedAt)}`)
              continue
            }
          }
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) {
          log.warn(`[sync] ENCOLANDO blob: path=${localEntry.path}, checksum=${localEntry.checksum.slice(0,12)}..., size=${localEntry.size}`)
          pendingUploads.push(localEntry)
          continue
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) continue

        uploaded++
        localByPath.set(localEntry.path, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
        remoteByPath.set(localEntry.path, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
      }

      // Process pending uploads in parallel batches after the main loop
      if (pendingUploads.length > 0) {
        log.warn(`[sync] Procesando ${pendingUploads.length} uploads pendientes en paralelo (concurrencia=${BLOB_UPLOAD_CONCURRENCY})...`)
        for (let i = 0; i < pendingUploads.length; i += BLOB_UPLOAD_CONCURRENCY) {
          const batch = pendingUploads.slice(i, i + BLOB_UPLOAD_CONCURRENCY)
          syncProgressService.setMessage(`Subiendo blobs: ${Math.min(i + BLOB_UPLOAD_CONCURRENCY, pendingUploads.length)}/${pendingUploads.length}...`)
          const results = await Promise.allSettled(
            batch.map(e =>
              withTimeout(
                this.uploadMediaBlob(drive, config.workspaceId, e, folderId),
                BLOB_UPLOAD_TIMEOUT_MS,
                `Timeout subiendo blob (${BLOB_UPLOAD_TIMEOUT_MS / 1000}s): ${e.path}`
              )
            )
          )
          for (const [j, result] of results.entries()) {
            const entry = batch[j]
            if (result.status === 'fulfilled') {
              const fileId = result.value
              remoteBlobByChecksum.set(entry.checksum, fileId)
              entry.driveFileId = fileId
              uploaded++
              localByPath.set(entry.path, { ...entry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: fileId })
              remoteByPath.set(entry.path, { ...entry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: fileId })
            } else {
              log.error(`[sync] Error subiendo blob para ${entry.path}:`, result.reason instanceof Error ? result.reason.message : result.reason)
            }
          }
        }
      }
    }

    if (mode === 'pull') {
      // Salvaguarda: si el manifiesto remoto está vacío (no existe en Drive o
      // workspaceId no coincide), NO borrar archivos locales. Solo descargar
      // lo que falte.
      const remoteTrusted = remoteManifest.entries.length > 0

      syncProgressService.setMessage(`Sincronizando ${remoteManifest.entries.length} archivos de medios (pull, remoteTrusted=${remoteTrusted})...`)
      for (const [index, remoteEntry] of remoteManifest.entries.entries()) {
        if (index % 20 === 0 && index > 0) {
          syncProgressService.setMessage(`Procesando medios remotos: ${index}/${remoteManifest.entries.length}...`)
        }
        if (remoteEntry.deletedAt) {
          // Solo borrar archivo local si también está eliminado en DB local
          // (previene borrados espurios cuando el manifiesto remoto está
          // inconsistente).
          if (remoteTrusted && !localByPath.has(remoteEntry.path)) {
            const localFullPath = path.join(getMediaDir(), remoteEntry.path)
            if (await fs.pathExists(localFullPath)) await fs.remove(localFullPath)
          }
          localByPath.set(remoteEntry.path, { ...remoteEntry, lastSyncedAt: nowIso })
          continue
        }

        const localEntry = localByPath.get(remoteEntry.path)
        let remoteFileId = remoteBlobByChecksum.get(remoteEntry.checksum)

        if (remoteFileId && remoteEntry.driveFileId === remoteFileId && driveFileIdVerifications < MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE) {
          driveFileIdVerifications++
          const exists = await syncDriveOpsService.remoteFileIdExists(drive, remoteFileId)
          if (!exists) {
            remoteBlobByChecksum.delete(remoteEntry.checksum)
            remoteFileId = undefined
          }
        }

        if (!remoteFileId) {
          const canHealFromLocal =
            localEntry?.checksum === remoteEntry.checksum &&
            !localEntry.deletedAt &&
            (await fs.pathExists(path.join(getMediaDir(), remoteEntry.path)))

          if (canHealFromLocal) {
            const lastSyncedAt = localEntry?.lastSyncedAt || remoteEntry.lastSyncedAt
            if (lastSyncedAt && (nowMs - Date.parse(lastSyncedAt)) < BLOB_REUPLOAD_GRACE_MS) continue

            try {
              const healedFileId = await withTimeout(
                this.uploadMediaBlob(drive, config.workspaceId, remoteEntry, folderId),
                BLOB_UPLOAD_TIMEOUT_MS,
                `[sync] Timeout sanando blob (${BLOB_UPLOAD_TIMEOUT_MS / 1000}s): ${remoteEntry.path}`
              )
              remoteBlobByChecksum.set(remoteEntry.checksum, healedFileId)
              remoteFileId = healedFileId
              localByPath.set(remoteEntry.path, { ...(localEntry || remoteEntry), ...remoteEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: healedFileId })
            } catch {
              log.warn(`[sync] No se pudo reparar blob remoto desde copia local para ${remoteEntry.path}`)
            }
          }

          if (!remoteFileId) {
            missingRemoteBlobs++
            continue
          }
        }

        if (localEntry?.checksum === remoteEntry.checksum && !localEntry.deletedAt) continue

        try {
          await this.downloadAndVerifyBlobChecksum(drive, remoteFileId, remoteEntry.path, remoteEntry.checksum)
        } catch (err: any) {
          if (syncDriveOpsService.isDriveNotFoundError(err)) {
            remoteBlobByChecksum.delete(remoteEntry.checksum)
            missingRemoteBlobs++
          } else {
            log.warn(`[sync] Error descargando ${remoteEntry.path}:`, err.message || err)
          }
          continue
        }

        downloaded++
        localByPath.set(remoteEntry.path, { ...remoteEntry, deletedAt: null, lastSyncedAt: nowIso })
      }
    }

    const nextLocalManifest: MediaManifestFile = {
      schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: nowIso,
      entries: Array.from(localByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
    }

    await writeJson(getLocalMediaManifestPath(), nextLocalManifest)

    if (mode === 'push') {
      const sinFileId = Array.from(remoteByPath.values()).filter(e => !e.driveFileId && !e.deletedAt)
      if (sinFileId.length > 0) {
        log.warn(`[sync] Entradas activas sin driveFileId en remoteByPath: ${sinFileId.length}`)
        for (const e of sinFileId.slice(0, 5)) log.warn(`  - ${e.path} (checksum=${e.checksum.slice(0,12)}...)`)
      }

      const nextRemoteManifest: MediaManifestFile = {
        schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
        workspaceId: config.workspaceId,
        deviceId: appInstanceId,
        updatedAt: nowIso,
        entries: Array.from(remoteByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
      }
      await this.writeRemoteMediaManifest(drive, config.workspaceId, nextRemoteManifest, folderId)
    }

    log.warn(`[sync] Media sync completado: ${uploaded} subidos, ${downloaded} descargados, ${missingRemoteBlobs} blobs faltantes, ${driveFileIdVerifications} verificaciones`)
    return { uploaded, downloaded, missingRemoteBlobs }
  }
}

export const syncMediaService = new SyncMediaService()
