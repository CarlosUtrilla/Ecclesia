import { drive_v3 } from 'googleapis'
import { driveClientService } from './oplog-drive-client.service'
import { REMOTE_OPLOG_FILE_NAME } from './oplog.config'
import { getTokenFilePath } from './oplog-shared'
import fs from 'fs-extra'
import { Readable } from 'stream'
import { oplogLogInfo, oplogLogWarn, oplogLogError } from './oplog-logger'

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
      const tokenPath = getTokenFilePath()
      const exists = await fs.pathExists(tokenPath)
      oplogLogInfo(`[Drive] isAvailable: tokenPath=${tokenPath}, exists=${exists}`)
      return exists
    } catch (e: any) {
      oplogLogWarn(`[Drive] isAvailable error: ${e.message}`)
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

  /**
   * Descarga el OpLog remoto.
   *
   * `skipIfGeneration` corta antes de traer el cuerpo cuando la generación
   * remota coincide con la que ya conocemos: la generación se resuelve con una
   * llamada de metadatos que ya se hacía igualmente, así que ahorra la descarga
   * completa (~1.9 MB) y, sobre todo, el `load()` + `merge()` de Automerge que
   * vienen después y son síncronos. Devuelve `data: null` en ese caso.
   */
  async downloadOplog(
    skipIfGeneration?: number,
  ): Promise<{ data: Uint8Array | null; fileId: string; generation: number } | null> {
    oplogLogInfo('[Drive] downloadOplog: starting...')
    try {
      const drive = await this.getDrive()
      oplogLogInfo('[Drive] downloadOplog: got drive client')
      const folderId = await this.getFolderId()
      oplogLogInfo(`[Drive] downloadOplog: folderId=${folderId}`)

      const search = await drive.files.list({
        q: `name='${REMOTE_OPLOG_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, headRevisionId)',
        pageSize: 1,
      })
      oplogLogInfo(`[Drive] downloadOplog: search found ${search.data.files?.length ?? 0} files`)

      const file = search.data.files?.[0]
      if (!file?.id) {
        oplogLogInfo('[Drive] downloadOplog: no file found')
        return null
      }
      oplogLogInfo(`[Drive] downloadOplog: file found, id=${file.id}`)

      const gen = await this.getFileGeneration(file.id)
      oplogLogInfo(`[Drive] downloadOplog: generation=${gen}`)

      if (skipIfGeneration !== undefined && skipIfGeneration > 0 && gen === skipIfGeneration) {
        oplogLogInfo(`[Drive] downloadOplog: sin cambios (generation=${gen}), se omite la descarga`)
        return { data: null, fileId: file.id, generation: gen }
      }

      const resp = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      )
      oplogLogInfo(`[Drive] downloadOplog: downloaded ${((resp.data as ArrayBuffer)?.byteLength ?? 0)} bytes`)

      return {
        data: new Uint8Array(resp.data as ArrayBuffer),
        fileId: file.id,
        generation: gen,
      }
    } catch (err: any) {
      oplogLogError(`[Drive] downloadOplog error: ${err.message}`, { code: err.code, status: err.status })
      throw err
    }
  }

  async uploadOplog(
    data: Uint8Array,
    ifGenerationMatch?: number
  ): Promise<{ fileId: string; generation: number }> {
    oplogLogInfo(`[Drive] uploadOplog: starting, dataLen=${data.length}, ifGenerationMatch=${ifGenerationMatch}`)
    const drive = await this.getDrive()
    const folderId = await this.getFolderId()

    const existing = await this.findOplogFile()
    oplogLogInfo(`[Drive] uploadOplog: existing=${existing ? JSON.stringify(existing) : 'null'}`)

    if (existing?.id) {
      const gen = ifGenerationMatch ?? (await this.getFileGeneration(existing.id))
      oplogLogInfo(`[Drive] uploadOplog: updating existing, gen=${gen}`)

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
        oplogLogInfo(`[Drive] uploadOplog: updated, newGen=${newGen}`)
        return { fileId: res.data.id!, generation: newGen }
      } catch (err: any) {
        if (err?.code === 412 || err?.status === 412) {
          oplogLogWarn(`[Drive] uploadOplog: concurrency error (412), currentGen=${await this.getFileGeneration(existing.id)}`)
          const currentGen = await this.getFileGeneration(existing.id)
          throw new OplogConcurrencyError(currentGen)
        }
        oplogLogError(`[Drive] uploadOplog: update error: ${err.message}`, { code: err.code, status: err.status })
        throw err
      }
    } else {
      oplogLogInfo('[Drive] uploadOplog: creating new file')
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
      oplogLogInfo(`[Drive] uploadOplog: created, fileId=${res.data.id!}, gen=${newGen}`)
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
