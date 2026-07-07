import { drive_v3 } from 'googleapis'
import { driveClientService } from '../sync/sync-drive-client.service'
import { getRemoteBlobFileName } from './oplog.config'
import type { BlobOperation } from './oplog.types'
import { getMediaDir, getLocalMediaManifestPath } from '../sync/sync.config'
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

    const CONCURRENCY = 5

    const runOp = async (op: BlobOperation): Promise<void> => {
      try {
        switch (op.type) {
          case 'download': {
            if (await this.blobExistsLocally(op.checksum, manifest)) {
              result.downloaded++
              return
            }
            log.info(`[OplogBlob] Descargando ${op.checksum} → ${op.path}`)
            await this.downloadBlob(drive, folderId, op.checksum, path.join(mediaRoot, op.path))
            await this.addToManifest(op.checksum, op.path)
            result.downloaded++
            return
          }

          case 'upload': {
            const remoteName = getRemoteBlobFileName(op.checksum)
            const exists = await this.blobExistsOnDrive(drive, folderId, remoteName)
            if (exists) {
              uploadSkipped++
              log.info(`[OplogBlob] Ya existe en Drive: ${op.checksum} (${op.localPath})`)
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

    for (let i = 0; i < ops.length; i += CONCURRENCY) {
      const batch = ops.slice(i, i + CONCURRENCY)
      await Promise.allSettled(batch.map(runOp))
    }

    await this.saveManifest()
    const uploadedCount = result.uploaded - uploadSkipped
    log.info(`[OplogBlob] Resumen: ${uploadedCount} subidos, ${uploadErrors} fallos, ${uploadSkipped} saltados (ya existentes), ${result.downloaded} descargados, ${result.deleted} eliminados`)

    return result
  }

  private async downloadBlob(drive: drive_v3.Drive, folderId: string, checksum: string, destPath: string): Promise<void> {
    const remoteName = getRemoteBlobFileName(checksum)

    const search = await drive.files.list({
      q: `name='${remoteName}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1,
    })

    const file = search.data.files?.[0]
    if (!file?.id) {
      log.warn(`[OplogBlob] Blob remoto no encontrado: ${remoteName}`)
      return
    }

    const resp = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    await fs.ensureDir(path.dirname(destPath))
    await fs.writeFile(destPath, Buffer.from(resp.data as ArrayBuffer))
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
    return manifest.entries.some(e => e.checksum === checksum)
  }

  private async blobExistsOnDrive(drive: drive_v3.Drive, folderId: string, remoteName: string): Promise<boolean> {
    const search = await drive.files.list({
      q: `name='${remoteName}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1,
    })
    return (search.data.files?.length ?? 0) > 0
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

    let pageToken: string | undefined
    do {
      const res = await drive.files.list({
        q: `name starts with '${BLOB_FILE_PREFIX}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 100,
        pageToken,
      })

      for (const file of res.data.files ?? []) {
        const checksum = this.checksumFromBlobName(file.name ?? '')
        if (checksum && !activeChecksums.has(checksum)) {
          const ageDays = (Date.now() - new Date(file.modifiedTime ?? 0).getTime()) / 86400000
          if (ageDays >= 7) {
            await drive.files.delete({ fileId: file.id! })
            deleted++
          }
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)

    return deleted
  }

  private checksumFromBlobName(name: string): string | null {
    if (!name.startsWith(BLOB_FILE_PREFIX) || !name.endsWith('.bin')) return null
    return name.slice(BLOB_FILE_PREFIX.length, -4)
  }
}

export const oplogBlobService = new OplogBlobService()
