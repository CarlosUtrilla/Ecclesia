import { drive_v3 } from 'googleapis'
import { driveClientService } from './oplog-drive-client.service'
import { getRemoteBlobFileName } from './oplog.config'
import type { BlobOperation } from './oplog.types'
import { getMediaDir, getLocalMediaManifestPath } from './oplog-shared'
import path from 'path'
import fs from 'fs-extra'
import { createHash } from 'crypto'
import log from 'electron-log'
import { Readable } from 'stream'

interface MediaManifestEntry {
  path: string
  size: number
  checksum: string
  mtime: number
}

interface MediaManifest {
  entries: MediaManifestEntry[]
}

const BLOB_FILE_PREFIX = 'ecclesia-blob-'

export class OplogBlobService {
  async processBlobOps(
    ops: BlobOperation[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ downloaded: number; uploaded: number; deleted: number; moved: number }> {
    const result = { downloaded: 0, uploaded: 0, deleted: 0, moved: 0 }
    if (ops.length === 0) return result

    const drive = await driveClientService.getDriveClientFromTokensOnly()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const mediaRoot = getMediaDir()
    const manifest = await this.readLocalManifest()
    const total = ops.length
    let uploadErrors = 0
    let uploadSkipped = 0
    let completed = 0

    const remoteBlobs = await this.listAllBlobFiles(drive, folderId)
    const remoteBlobNames = new Map<string, string>()
    for (const f of remoteBlobs) {
      remoteBlobNames.set(f.name, f.id)
    }

    const uploadOps = ops.filter(o => o.type === 'upload')
    const missingFromDrive = new Set<string>()
    for (const op of uploadOps) {
      const name = getRemoteBlobFileName(op.checksum)
      if (!remoteBlobNames.has(name)) {
        missingFromDrive.add(name)
      }
    }

    const runOp = async (op: BlobOperation): Promise<void> => {
      try {
        switch (op.type) {
          case 'download': {
            if (await this.blobExistsLocally(op.checksum, manifest)) {
              result.downloaded++
              return
            }
            const remoteName = getRemoteBlobFileName(op.checksum)
            const remoteFileId = remoteBlobNames.get(remoteName)
            if (!remoteFileId) {
              log.warn(`[OplogBlob] Blob remoto no encontrado: ${remoteName}`)
              return
            }
            log.info(`[OplogBlob] Descargando ${op.checksum} → ${op.path}`)
            await this.downloadBlobWithTimeout(drive, remoteFileId, path.join(mediaRoot, op.path), 300_000)
            await this.addToManifest(op.checksum, op.path)
            log.info(`[OplogBlob] Descarga completada: ${op.checksum} → ${op.path}`)
            result.downloaded++
            return
          }

          case 'upload': {
            const remoteName = getRemoteBlobFileName(op.checksum)
            if (!missingFromDrive.has(remoteName)) {
              uploadSkipped++
            } else {
              log.info(`[OplogBlob] Subiendo ${op.checksum} desde ${op.localPath}`)
              await this.uploadBlob(drive, folderId, remoteName, op.localPath)
              log.info(`[OplogBlob] Subido correctamente: ${op.checksum}`)
            }
            result.uploaded++
            return
          }

          case 'delete':
            await this.deleteLocalFile(path.join(mediaRoot, op.path))
            await this.removeFromManifest(op.checksum)
            result.deleted++
            return

          case 'move':
            await this.moveLocalFile(path.join(mediaRoot, op.oldPath), path.join(mediaRoot, op.newPath))
            result.moved++
            return
        }
      } catch (err: any) {
        uploadErrors++
        log.error(`[OplogBlob] Error en ${op.type} de ${op.checksum} (${(op as any).localPath ?? (op as any).path ?? ''}): ${err.message}`)
        if (err?.response?.status === 429) {
          log.warn('[OplogBlob] Rate limit alcanzado — se reintentará en próximo ciclo')
        }
      } finally {
        completed++
        if (onProgress) onProgress(completed, total)
      }
    }

    const CONCURRENCY = 5
    const chunks: BlobOperation[][] = []
    for (let i = 0; i < ops.length; i += CONCURRENCY) {
      chunks.push(ops.slice(i, i + CONCURRENCY))
    }
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(runOp))
    }

    await this.saveManifest()
    const uploadedCount = result.uploaded - uploadSkipped
    if (total > 1) {
      log.info(`[OplogBlob] Resumen: ${uploadedCount} subidos, ${uploadErrors} fallos, ${uploadSkipped} ya en Drive, ${result.downloaded} descargados, ${result.deleted} eliminados`)
    }

    return result
  }

  private async listAllBlobFiles(drive: drive_v3.Drive, folderId: string): Promise<Array<{ id: string; name: string }>> {
    const files: Array<{ id: string; name: string }> = []
    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `name starts with '${BLOB_FILE_PREFIX}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
      })
      for (const f of res.data.files ?? []) {
        if (f.id && f.name) files.push({ id: f.id, name: f.name })
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return files
  }

  private async downloadBlob(drive: drive_v3.Drive, fileId: string, destPath: string): Promise<void> {
    const resp = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    await fs.ensureDir(path.dirname(destPath))
    await fs.writeFile(destPath, Buffer.from(resp.data as ArrayBuffer))
  }

  private async downloadBlobWithTimeout(
    drive: drive_v3.Drive,
    fileId: string,
    destPath: string,
    timeoutMs: number,
  ): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms descargando ${destPath}`)), timeoutMs)
    })
    try {
      await Promise.race([
        this.downloadBlob(drive, fileId, destPath),
        timeoutPromise,
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private async uploadBlob(drive: drive_v3.Drive, folderId: string, remoteName: string, localPath: string): Promise<void> {
    const fileBuffer = await fs.readFile(localPath)
    await drive.files.create({
      requestBody: { name: remoteName, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: Readable.from(fileBuffer) },
      fields: 'id',
    })
  }

  private async blobExistsLocally(checksum: string, manifest: MediaManifest): Promise<boolean> {
    const entry = manifest.entries.find(e => e.checksum === checksum)
    if (!entry) return false

    const filePath = path.join(getMediaDir(), entry.path)
    const exists = await fs.pathExists(filePath)
    if (!exists) {
      manifest.entries = manifest.entries.filter(e => e.checksum !== checksum)
      await fs.writeJson(getLocalMediaManifestPath(), manifest, { spaces: 2 })
    }
    return exists
  }

  private async readLocalManifest(): Promise<MediaManifest> {
    try {
      const data = await fs.readJson(getLocalMediaManifestPath())
      return { entries: data?.entries ?? [] }
    } catch {
      return { entries: [] }
    }
  }

  private async saveManifest(): Promise<void> {
    /* la persistencia del manifest se maneja inline en addToManifest/removeFromManifest */
  }

  private currentManifest: MediaManifest | null = null

  private async getManifest(): Promise<MediaManifest> {
    if (!this.currentManifest) {
      this.currentManifest = await this.readLocalManifest()
    }
    return this.currentManifest
  }

  private async addToManifest(checksum: string, filePath: string): Promise<void> {
    const manifest = await this.getManifest()
    if (!manifest.entries.some(e => e.checksum === checksum)) {
      manifest.entries.push({ checksum, path: filePath, size: 0, mtime: Date.now() })
    }
    await fs.writeJson(getLocalMediaManifestPath(), manifest, { spaces: 2 })
  }

  private async removeFromManifest(checksum: string): Promise<void> {
    const manifest = await this.getManifest()
    manifest.entries = manifest.entries.filter(e => e.checksum !== checksum)
    await fs.writeJson(getLocalMediaManifestPath(), manifest, { spaces: 2 })
  }

  private async deleteLocalFile(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath)
    } catch { /* already gone */ }
  }

  private async moveLocalFile(oldPath: string, newPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(newPath))
    try {
      await fs.move(oldPath, newPath, { overwrite: true })
    } catch { /* source may not exist */ }
  }

  async computeChecksum(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath)
    return 'sha256-' + createHash('sha256').update(buffer).digest('hex')
  }

  async garbageCollectBlobs(activeChecksums: Set<string>): Promise<number> {
    const drive = await driveClientService.getDriveClientFromTokensOnly()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    let deleted = 0
    let scanned = 0
    let pageNum = 0

    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `name starts with '${BLOB_FILE_PREFIX}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 1000,
        pageToken,
      })

      pageNum++
      const filesOnPage = res.data.files?.length ?? 0
      scanned += filesOnPage
      log.info(`[OplogBlobGC] Página ${pageNum}: ${filesOnPage} blobs escaneados (total: ${scanned})`)

      for (const file of res.data.files ?? []) {
        const checksum = this.checksumFromBlobName(file.name ?? '')
        if (checksum && !activeChecksums.has(checksum)) {
          const ageDays = (Date.now() - new Date(file.modifiedTime ?? 0).getTime()) / 86400000
          if (ageDays >= 7) {
            await drive.files.delete({ fileId: file.id! })
            deleted++
            log.info(`[OplogBlobGC] Eliminado blob huérfano antiguo: ${file.name}`)
          }
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)

    log.info(`[OplogBlobGC] Completado: ${scanned} blobs escaneados, ${deleted} eliminados`)
    return deleted
  }

  private checksumFromBlobName(name: string): string | null {
    if (!name.startsWith(BLOB_FILE_PREFIX) || !name.endsWith('.bin')) return null
    return name.slice(BLOB_FILE_PREFIX.length, -4)
  }
}

export const oplogBlobService = new OplogBlobService()
