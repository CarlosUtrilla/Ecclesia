import { drive_v3 } from 'googleapis'
import { driveClientService } from '../sync/sync-drive-client.service'
import { REMOTE_OPLOG_FILE_NAME } from './oplog.config'
import { getTokenFilePath } from '../sync/sync.config'
import fs from 'fs-extra'
import { Readable } from 'stream'

export class OplogConcurrencyError extends Error {
  constructor(public remoteGeneration: number) {
    super('Concurrent modification detected: another device pushed first')
    this.name = 'OplogConcurrencyError'
  }
}

export class OplogDriveService {
  private oplogFileId: string | null = null
  private oplogFileGeneration: number | null = null

  async isAvailable(): Promise<boolean> {
    try {
      return await fs.pathExists(getTokenFilePath())
    } catch {
      return false
    }
  }

  private async getDrive(): Promise<drive_v3.Drive> {
    return driveClientService.getDriveClientFromTokensOnly()
  }

  private async getFolderId(): Promise<string> {
    const drive = await this.getDrive()
    return driveClientService.getOrCreateEcclesiaFolder(drive)
  }

  async findOplogFile(): Promise<{ id: string; generation: number } | null> {
    const drive = await this.getDrive()
    const folderId = await this.getFolderId()

    const res = await drive.files.list({
      q: `name='${REMOTE_OPLOG_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, size, modifiedTime)',
      pageSize: 1,
    })

    const file = res.data.files?.[0]
    if (!file?.id) return null

    this.oplogFileId = file.id
    return { id: file.id, generation: 0 }
  }

  async getFileGeneration(fileId: string): Promise<number> {
    const drive = await this.getDrive()

    const res = await drive.files.get({
      fileId,
      fields: 'id, size, modifiedTime, headRevisionId',
      supportsAllDrives: true,
    })

    if (res.data.headRevisionId) {
      const gen = parseInt(res.data.headRevisionId.replace(/\D/g, ''), 10) || 0
      this.oplogFileGeneration = gen
      return gen
    }

    return 0
  }

  async downloadOplog(): Promise<{ data: Uint8Array; fileId: string; generation: number } | null> {
    const drive = await this.getDrive()
    const folderId = await this.getFolderId()

    const search = await drive.files.list({
      q: `name='${REMOTE_OPLOG_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, headRevisionId)',
      pageSize: 1,
    })

    const file = search.data.files?.[0]
    if (!file?.id) return null

    const gen = await this.getFileGeneration(file.id)

    const resp = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    return {
      data: new Uint8Array(resp.data as ArrayBuffer),
      fileId: file.id,
      generation: gen,
    }
  }

  async uploadOplog(
    data: Uint8Array,
    ifGenerationMatch?: number
  ): Promise<{ fileId: string; generation: number }> {
    const drive = await this.getDrive()
    const folderId = await this.getFolderId()

    const existing = await this.findOplogFile()

    if (existing?.id) {
      const gen = ifGenerationMatch ?? (await this.getFileGeneration(existing.id))

      try {
        const res = await drive.files.update({
          fileId: existing.id,
          media: {
            mimeType: 'application/octet-stream',
            body: Readable.from(Buffer.from(data)),
          },
          requestBody: { name: REMOTE_OPLOG_FILE_NAME },
          ...(gen > 0 ? { ifGenerationMatch: gen } : {}),
          fields: 'id, headRevisionId',
        })

        const newGen = parseInt((res.data.headRevisionId ?? '').replace(/\D/g, ''), 10) || 0
        this.oplogFileId = res.data.id!
        this.oplogFileGeneration = newGen
        return { fileId: res.data.id!, generation: newGen }
      } catch (err: any) {
        if (err?.code === 412 || err?.status === 412) {
          const currentGen = await this.getFileGeneration(existing.id)
          throw new OplogConcurrencyError(currentGen)
        }
        throw err
      }
    } else {
      const res = await drive.files.create({
        requestBody: {
          name: REMOTE_OPLOG_FILE_NAME,
          parents: [folderId],
        },
        media: {
          mimeType: 'application/octet-stream',
          body: Readable.from(Buffer.from(data)),
        },
        fields: 'id, headRevisionId',
      })

      const newGen = parseInt((res.data.headRevisionId ?? '').replace(/\D/g, ''), 10) || 0
      this.oplogFileId = res.data.id!
      this.oplogFileGeneration = newGen
      return { fileId: res.data.id!, generation: newGen }
    }
  }

  async deleteOplogFile(): Promise<void> {
    const existing = await this.findOplogFile()
    if (existing?.id) {
      const drive = await this.getDrive()
      await drive.files.delete({ fileId: existing.id })
    }
  }
}

export const oplogDriveService = new OplogDriveService()
