import log from 'electron-log'
import { drive_v3 } from 'googleapis'
import fs from 'fs-extra'
import path from 'path'
import { randomUUID } from 'crypto'
import { streamToString, computeFileChecksum } from './sync.utils'

const DEFAULT_PAGE_SIZE = 100
const MAX_LIST_PAGE_SIZE = 1000

export class SyncDriveOpsService {
  async findFileByName(
    drive: drive_v3.Drive,
    folderId: string,
    fileName: string,
    pageSize = 1
  ) {
    const result = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize,
      orderBy: 'modifiedTime desc'
    })
    return result.data.files?.[0] || null
  }

  async upsertFile(
    drive: drive_v3.Drive,
    folderId: string,
    fileName: string,
    body: unknown,
    mimeType = 'application/json'
  ) {
    const existing = await this.findFileByName(drive, folderId, fileName)
    const media = { mimeType, body: JSON.stringify(body, (_k, v) => typeof v === 'bigint' ? Number(v) : v) }

    if (existing?.id) {
      await drive.files.update({ fileId: existing.id, media, fields: 'id' })
      return existing.id
    }

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: 'id'
    })
    return created.data.id!
  }

  async listFilesByPrefix(
    drive: drive_v3.Drive,
    folderId: string,
    prefix: string,
    suffix = ''
  ): Promise<Map<string, string>> {
    const byKey = new Map<string, string>()
    let pageToken: string | undefined

    const safePrefix = prefix.replace(/'/g, "\\'")
    do {
      const result = await drive.files.list({
        q: `name contains '${safePrefix}' and '${folderId}' in parents and trashed = false`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name)',
        pageSize: MAX_LIST_PAGE_SIZE,
        pageToken
      })

      for (const file of result.data.files || []) {
        const name = file.name || ''
        if (!name.startsWith(prefix) || !name.endsWith(suffix) || !file.id) continue
        const key = name.slice(prefix.length, suffix ? -suffix.length : undefined)
        if (key) byKey.set(key, file.id)
      }
      pageToken = result.data.nextPageToken || undefined
    } while (pageToken)

    return byKey
  }

  async downloadFileContent(drive: drive_v3.Drive, fileId: string): Promise<string> {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )
    return streamToString(response.data as NodeJS.ReadableStream)
  }

  async downloadJsonFile<T>(drive: drive_v3.Drive, fileId: string): Promise<T | null> {
    try {
      const raw = await this.downloadFileContent(drive, fileId)
      return JSON.parse(raw) as T
    } catch (err) {
      if (this.isDriveProcessingError(err)) throw err
      return null
    }
  }

  async downloadFileToDisk(
    drive: drive_v3.Drive,
    fileId: string,
    destination: string,
    options?: { expectedChecksum?: string; maxRetries?: number }
  ): Promise<string> {
    const tempFile = path.join(path.dirname(destination), `.${randomUUID()}.tmp`)

    try {
      await fs.ensureDir(path.dirname(tempFile))
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(tempFile)
        ;(response.data as NodeJS.ReadableStream).pipe(writer)
        writer.on('finish', () => resolve())
        writer.on('error', reject)
      })

      if (options?.expectedChecksum) {
        const actualChecksum = await computeFileChecksum(tempFile)
        if (actualChecksum !== options.expectedChecksum) {
          await fs.remove(tempFile).catch(() => undefined)
          throw new Error(
            `Checksum mismatch: expected ${options.expectedChecksum}, got ${actualChecksum}`
          )
        }
      }

      await fs.ensureDir(path.dirname(destination))
      const maxRetries = options?.maxRetries ?? 3
      let lastError: Error | null = null

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await fs.move(tempFile, destination, { overwrite: true })
          if (process.platform === 'win32') {
            try { await fs.chmod(destination, 0o644) } catch { /* ignore */ }
          }
          return options?.expectedChecksum || ''
        } catch (err) {
          lastError = err as Error
          const isLock =
            err instanceof Error &&
            (err.message.includes('EBUSY') || err.message.includes('EPERM') || err.message.includes('EACCES'))
          if (!isLock || attempt >= maxRetries - 1) throw err
          log.warn(`[sync] Archivo bloqueado, reintentando mover (intento ${attempt + 2}/${maxRetries})`)
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }

      throw new Error(`No se pudo mover archivo después de ${maxRetries} intentos: ${lastError?.message || 'unknown'}`)
    } catch (err) {
      if (await fs.pathExists(tempFile)) await fs.remove(tempFile).catch(() => undefined)
      throw err
    }
  }

  async uploadBlob(
    drive: drive_v3.Drive,
    folderId: string,
    fileName: string,
    localPath: string
  ): Promise<string> {
    if (!(await fs.pathExists(localPath))) {
      throw new Error(`Archivo local no encontrado: ${localPath}`)
    }

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: fs.createReadStream(localPath) },
      fields: 'id'
    })

    const fileId = created.data.id
    if (!fileId) {
      throw new Error(`[sync] Drive no devolvió fileId para ${fileName}`)
    }
    return fileId
  }

  async remoteFileIdExists(drive: drive_v3.Drive, fileId: string): Promise<boolean> {
    try {
      await drive.files.get({ fileId, fields: 'id' })
      return true
    } catch (err) {
      if (this.isDriveProcessingError(err)) return true
      return false
    }
  }

  isDriveNotFoundError(error: unknown): boolean {
    const err = (error || {}) as Record<string, unknown>
    if (err.code === 404 || (err as any)?.status === 404) return true
    const msg = error instanceof Error ? error.message.toLowerCase() : ''
    return msg.includes('not found') || msg.includes('file not found')
  }

  isDriveProcessingError(error: unknown): boolean {
    const err = (error || {}) as Record<string, unknown>
    if (err.code === 403 || err.code === 429) return true
    if ((err as any)?.response?.status === 403 || (err as any)?.response?.status === 429) return true
    return false
  }
}

export const syncDriveOpsService = new SyncDriveOpsService()
