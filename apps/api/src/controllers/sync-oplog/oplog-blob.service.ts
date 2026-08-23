import { drive_v3 } from 'googleapis'
import { driveClientService } from './oplog-drive-client.service'
import { getRemoteBlobFileName } from './oplog.config'
import type { BlobOperation } from './oplog.types'
import { getMediaDir, getLocalMediaManifestPath } from './oplog-shared'
import path from 'path'
import fs from 'fs-extra'
import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import log from 'electron-log'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

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
const CHECKSUM_CHUNK_SIZE = 1024 * 1024
const CHECKSUM_CACHE_MAX = 5000

export class OplogBlobService {
  /** checksums ya calculados, keyed por `path:size:mtime`. */
  private checksumCache = new Map<string, string>()

  async processBlobOps(
    ops: BlobOperation[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ downloaded: number; uploaded: number; deleted: number; moved: number }> {
    const result = { downloaded: 0, uploaded: 0, deleted: 0, moved: 0 }
    if (ops.length === 0) return result

    const drive = await driveClientService.getDriveClientFromTokensOnly()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const mediaRoot = getMediaDir()
    await this.getManifest()
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
            if (await this.blobExistsLocally(op.checksum)) {
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

  // Descarga en streaming: con `arraybuffer` el archivo entero pasaba por memoria
  // (dos veces, contando la copia a Buffer) antes de escribirse a disco.
  private async downloadBlob(drive: drive_v3.Drive, fileId: string, destPath: string): Promise<void> {
    const resp = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )
    await fs.ensureDir(path.dirname(destPath))
    const tmpPath = `${destPath}.part`
    await pipeline(resp.data as unknown as Readable, fs.createWriteStream(tmpPath))
    await fs.move(tmpPath, destPath, { overwrite: true })
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
    await drive.files.create({
      requestBody: { name: remoteName, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: createReadStream(localPath) },
      fields: 'id',
    })
  }

  private async blobExistsLocally(checksum: string): Promise<boolean> {
    await this.getManifest()
    const entry = this.manifestIndex!.get(checksum)
    if (!entry) return false

    const filePath = path.join(getMediaDir(), entry.path)
    const exists = await fs.pathExists(filePath)
    if (!exists) {
      await this.removeFromManifest(checksum)
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

  /**
   * Una sola escritura por ciclo: antes cada alta/baja de blob reescribía el manifest
   * completo (con `spaces: 2`), lo que con cientos de blobs era O(n²) en disco.
   */
  private async saveManifest(): Promise<void> {
    if (!this.manifestDirty || !this.currentManifest) return
    await fs.writeJson(getLocalMediaManifestPath(), this.currentManifest)
    this.manifestDirty = false
  }

  private currentManifest: MediaManifest | null = null
  private manifestIndex: Map<string, MediaManifestEntry> | null = null
  private manifestDirty = false

  private async getManifest(): Promise<MediaManifest> {
    if (!this.currentManifest) {
      this.currentManifest = await this.readLocalManifest()
      this.manifestIndex = new Map(this.currentManifest.entries.map((e) => [e.checksum, e]))
    }
    return this.currentManifest
  }

  private async addToManifest(checksum: string, filePath: string): Promise<void> {
    const manifest = await this.getManifest()
    if (this.manifestIndex!.has(checksum)) return
    const entry: MediaManifestEntry = { checksum, path: filePath, size: 0, mtime: Date.now() }
    manifest.entries.push(entry)
    this.manifestIndex!.set(checksum, entry)
    this.manifestDirty = true
  }

  private async removeFromManifest(checksum: string): Promise<void> {
    const manifest = await this.getManifest()
    if (!this.manifestIndex!.delete(checksum)) return
    manifest.entries = manifest.entries.filter((e) => e.checksum !== checksum)
    this.manifestDirty = true
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

  /**
   * Hashea por streaming en vez de cargar el archivo entero en memoria: un vídeo de
   * varios cientos de MB bloqueaba el proceso principal durante segundos (y disparaba
   * el GC). El resultado se cachea por tamaño + mtime, así que un archivo que no cambió
   * no se vuelve a leer en los ciclos siguientes.
   */
  async computeChecksum(filePath: string): Promise<string> {
    let cacheKey: string | null = null
    try {
      const stat = await fs.stat(filePath)
      cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`
      const cached = this.checksumCache.get(cacheKey)
      if (cached) return cached
    } catch {
      // Sin stat seguimos: solo perdemos la cache
    }

    const hash = createHash('sha256')
    await pipeline(createReadStream(filePath, { highWaterMark: CHECKSUM_CHUNK_SIZE }), hash)
    const checksum = 'sha256-' + hash.digest('hex')

    if (cacheKey) {
      if (this.checksumCache.size >= CHECKSUM_CACHE_MAX) {
        this.checksumCache.clear()
      }
      this.checksumCache.set(cacheKey, checksum)
    }
    return checksum
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
