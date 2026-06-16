import { drive_v3 } from 'googleapis'
import path from 'path'
import fs from 'fs-extra'
import { randomUUID } from 'crypto'
import { getPrisma } from '../../prisma'
import { getMediaDir, getLocalMediaManifestPath } from './sync.config'
import {
  MEDIA_MANIFEST_SCHEMA_VERSION,
  MediaManifestEntry,
  MediaManifestFile,
  PersistedSyncConfig,
  getRemoteMediaManifestFileName,
  getRemoteMediaBlobFileName,
  BLOB_REUPLOAD_GRACE_MS,
  MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE
} from './sync.config'
import { readJsonSafe, writeJson, computeFileChecksum, streamToString } from './sync.utils'

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

      nextEntriesMap.set(relativePath, {
        path: relativePath,
        size: stats.size,
        checksum,
        mtime: stats.mtimeMs,
        deletedAt: null,
        lastSyncedAt: previous?.lastSyncedAt || null,
        driveFileId: canReuseChecksum ? previous?.driveFileId || null : null
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
    const result = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 1,
      orderBy: 'modifiedTime desc'
    })
    const metadata = result.data.files?.[0]
    if (!metadata?.id) return null

    const response = await drive.files.get(
      { fileId: metadata.id, alt: 'media' },
      { responseType: 'stream' }
    )
    const raw = await streamToString(response.data as NodeJS.ReadableStream)
    try {
      const parsed = JSON.parse(raw)
      if (
        !parsed ||
        parsed.schemaVersion !== MEDIA_MANIFEST_SCHEMA_VERSION ||
        parsed.workspaceId !== workspaceId
      ) {
        return null
      }
      return parsed as MediaManifestFile
    } catch {
      return null
    }
  }

  async writeRemoteMediaManifest(
    drive: drive_v3.Drive,
    workspaceId: string,
    manifest: MediaManifestFile,
    folderId: string
  ) {
    const fileName = getRemoteMediaManifestFileName(workspaceId)
    const result = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1
    })
    const existing = result.data.files?.[0]
    const media = { mimeType: 'application/json', body: JSON.stringify(manifest) }

    if (existing?.id) {
      await drive.files.update({ fileId: existing.id, media, fields: 'id' })
      return
    }
    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: 'id'
    })
  }

  async listRemoteMediaBlobs(
    drive: drive_v3.Drive,
    workspaceId: string,
    folderId: string
  ): Promise<Map<string, string>> {
    const prefix = getRemoteMediaBlobFileName(workspaceId, '')
    const basePrefix = prefix.slice(0, -64 - '.bin'.length) // Remove checksum + extension
    const byChecksum = new Map<string, string>()
    let pageToken: string | undefined

    do {
      const result = await drive.files.list({
        q: `name contains '${basePrefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken
      })

      for (const file of result.data.files || []) {
        const name = file.name || ''
        if (!name.startsWith(basePrefix) || !name.endsWith('.bin') || !file.id) continue
        const checksum = name.slice(basePrefix.length, -'.bin'.length)
        if (checksum) byChecksum.set(checksum, file.id)
      }
      pageToken = result.data.nextPageToken || undefined
    } while (pageToken)

    return byChecksum
  }

  async uploadMediaBlob(
    drive: drive_v3.Drive,
    workspaceId: string,
    entry: MediaManifestEntry,
    folderId: string
  ): Promise<string> {
    const fullPath = path.join(getMediaDir(), entry.path)
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`Archivo local de media no encontrado: ${entry.path}`)
    }

    const fileName = getRemoteMediaBlobFileName(workspaceId, entry.checksum)
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: fs.createReadStream(fullPath) },
      fields: 'id'
    })

    const fileId = created.data.id
    if (!fileId) {
      throw new Error(`[sync] Drive no devolvió fileId para blob de media: ${entry.path}`)
    }
    return fileId
  }

  async downloadAndVerifyBlobChecksum(
    drive: drive_v3.Drive,
    fileId: string,
    relativePath: string,
    expectedChecksum: string
  ): Promise<string> {
    const userMediaBase = getMediaDir()
    const tempFile = path.join(userMediaBase, `.${randomUUID()}.tmp`)
    const destination = path.join(userMediaBase, relativePath)

    try {
      await fs.ensureDir(path.dirname(tempFile))
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(tempFile)
        ;(response.data as NodeJS.ReadableStream).pipe(writer)
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      const actualChecksum = await computeFileChecksum(tempFile)
      if (actualChecksum !== expectedChecksum) {
        await fs.remove(tempFile)
        throw new Error(
          `Checksum mismatch for blob ${fileId}: expected ${expectedChecksum}, got ${actualChecksum}`
        )
      }

      await fs.ensureDir(path.dirname(destination))
      let moveSuccess = false
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fs.move(tempFile, destination, { overwrite: true })
          moveSuccess = true
          break
        } catch (err) {
          lastError = err as Error
          const isLock =
            err instanceof Error &&
            (err.message.includes('EBUSY') || err.message.includes('EPERM') || err.message.includes('EACCES'))
          if (isLock && attempt < 2) {
            console.warn(`[sync] Archivo bloqueado, reintentando mover ${relativePath} (intento ${attempt + 1}/3)`)
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
          } else if (!isLock) throw err
        }
      }

      if (!moveSuccess) {
        throw new Error(`No se pudo mover archivo descargado después de 3 intentos: ${lastError?.message || 'unknown error'}`)
      }

      if (process.platform === 'win32') {
        try { await fs.chmod(destination, 0o644) } catch { /* ignore */ }
      }

      return actualChecksum
    } catch (err) {
      if (await fs.pathExists(tempFile)) await fs.remove(tempFile).catch(() => undefined)
      throw err
    }
  }

  async remoteFileIdExists(drive: drive_v3.Drive, fileId: string): Promise<boolean> {
    try {
      await drive.files.get({ fileId, fields: 'id' })
      return true
    } catch {
      return false
    }
  }

  isDriveNotFoundError(error: unknown): boolean {
    const err = (error || {}) as Record<string, unknown>
    if (err.code === 404 || (err as any)?.status === 404) return true
    const msg = error instanceof Error ? error.message.toLowerCase() : ''
    return msg.includes('not found') || msg.includes('file not found')
  }

  async syncMediaManifest(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    mode: 'push' | 'pull',
    appInstanceId: string,
    folderId: string
  ) {
    const localManifest = await this.buildLocalMediaManifest(config, appInstanceId)
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
      const bySearch = await this.listRemoteMediaBlobs(drive, config.workspaceId, folderId)
      for (const c of checksumsSinFileId) {
        const fid = bySearch.get(c)
        if (fid) remoteBlobByChecksum.set(c, fid)
      }
    }

    let uploaded = 0
    let downloaded = 0
    let missingRemoteBlobs = 0
    let driveFileIdVerifications = 0
    const nowIso = new Date().toISOString()
    const nowMs = Date.now()

    if (mode === 'push') {
      for (const localEntry of localManifest.entries) {
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
              if (this.isDriveNotFoundError(err)) {
                shouldClear = true
                if (localEntry.checksum) remoteBlobByChecksum.delete(localEntry.checksum)
              } else { console.warn(`[sync] No se pudo eliminar blob de Drive para ${localEntry.path}:`, err) }
            }
          }

          remoteByPath.set(localEntry.path, { ...localEntry, lastSyncedAt: nowIso, driveFileId: shouldClear ? null : localEntry.driveFileId || remoteEntry?.driveFileId || null })
          localByPath.set(localEntry.path, { ...localEntry, lastSyncedAt: nowIso, driveFileId: shouldClear ? null : localEntry.driveFileId || remoteEntry?.driveFileId || null })
          continue
        }

        const remoteEntry = remoteByPath.get(localEntry.path)
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
          if (remoteEntry.driveFileId) {
            try {
              await this.downloadAndVerifyBlobChecksum(drive, remoteEntry.driveFileId, remoteEntry.path, remoteEntry.checksum)
              remoteBlobByChecksum.set(remoteEntry.checksum, remoteEntry.driveFileId)
              hasRemoteBlob = true
              continue
            } catch {
              if (this.isDriveNotFoundError(remoteEntry.driveFileId)) {
                remoteByPath.set(remoteEntry.path, { ...remoteEntry, driveFileId: null })
                hasRemoteBlob = false
              }
            }
          }

          if (!hasRemoteBlob) {
            const lastSyncedAt = localEntry.lastSyncedAt || remoteEntry.lastSyncedAt
            if (lastSyncedAt && (nowMs - Date.parse(lastSyncedAt)) < BLOB_REUPLOAD_GRACE_MS) continue
          }
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) {
          try {
            const fileId = await this.uploadMediaBlob(drive, config.workspaceId, localEntry, folderId)
            remoteBlobByChecksum.set(localEntry.checksum, fileId)
            localEntry.driveFileId = fileId
          } catch (err) {
            console.error(`[sync] Error subiendo blob para ${localEntry.path}:`, err instanceof Error ? err.message : err)
            continue
          }
        }

        if (!remoteBlobByChecksum.has(localEntry.checksum)) continue

        uploaded++
        localByPath.set(localEntry.path, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
        remoteByPath.set(localEntry.path, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: localEntry.driveFileId })
      }
    }

    if (mode === 'pull') {
      for (const remoteEntry of remoteManifest.entries) {
        if (remoteEntry.deletedAt) {
          const localFullPath = path.join(getMediaDir(), remoteEntry.path)
          if (await fs.pathExists(localFullPath)) await fs.remove(localFullPath)
          localByPath.set(remoteEntry.path, { ...remoteEntry, lastSyncedAt: nowIso })
          continue
        }

        const localEntry = localByPath.get(remoteEntry.path)
        let remoteFileId = remoteBlobByChecksum.get(remoteEntry.checksum)

        if (remoteFileId && remoteEntry.driveFileId === remoteFileId && driveFileIdVerifications < MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE) {
          driveFileIdVerifications++
          const exists = await this.remoteFileIdExists(drive, remoteFileId)
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
              const healedFileId = await this.uploadMediaBlob(drive, config.workspaceId, remoteEntry, folderId)
              remoteBlobByChecksum.set(remoteEntry.checksum, healedFileId)
              remoteFileId = healedFileId
              localByPath.set(remoteEntry.path, { ...(localEntry || remoteEntry), ...remoteEntry, deletedAt: null, lastSyncedAt: nowIso, driveFileId: healedFileId })
            } catch {
              console.warn(`[sync] No se pudo reparar blob remoto desde copia local para ${remoteEntry.path}`)
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
          if (this.isDriveNotFoundError(err)) {
            remoteBlobByChecksum.delete(remoteEntry.checksum)
            missingRemoteBlobs++
          } else {
            console.warn(`[sync] Error descargando ${remoteEntry.path}:`, err.message || err)
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
      const nextRemoteManifest: MediaManifestFile = {
        schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
        workspaceId: config.workspaceId,
        deviceId: appInstanceId,
        updatedAt: nowIso,
        entries: Array.from(remoteByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
      }
      await this.writeRemoteMediaManifest(drive, config.workspaceId, nextRemoteManifest, folderId)
    }

    return { uploaded, downloaded, missingRemoteBlobs }
  }
}

export const syncMediaService = new SyncMediaService()
