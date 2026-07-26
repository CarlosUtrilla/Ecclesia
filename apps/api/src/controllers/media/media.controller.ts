import fs from 'fs'
import path from 'path'
import { MediaService } from './media.service'
import { CreateMediaDto, UpdateMediaDto, MediaFilterDto } from './media.dto'
import { importPptxToPresentation } from '../../pptxConverter'
import { getPrisma } from '../../prisma'
import { RequestHandler } from '../../utils/RequestHandler'
import { UsingMulter } from '../../decorators/multerDecorator'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export class MediaController {
  private mediaService = new MediaService()

  async create({ body }: RequestHandler<CreateMediaDto>) {
    return await this.mediaService.create(body)
  }

  async findAll({ body }: RequestHandler<MediaFilterDto | undefined>) {
    return await this.mediaService.findAll(body)
  }

  async findOne({ body }: RequestHandler<{ id: string }>) {
    return await this.mediaService.findOne(parseInt(body.id))
  }

  async findByFilePath({ body }: RequestHandler<{ filePath: string }>) {
    return await this.mediaService.findByFilePath(body.filePath)
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 10 })
  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async importFile({
    file,
    files,
    body
  }: RequestHandler<{ folder?: string }, Express.Multer.File>) {
    const targetFiles = file ? [file] : (files ?? [])
    const results = await Promise.all(
      targetFiles.map(async (f) => {
        const ext = path.extname(f.originalname || f.path).toLowerCase()
        if (ext === '.pdf') {
          return [await this.mediaService.importPdfFromMulter(f, body.folder)]
        }
        if (ext === '.pptx') {
          const result = await importPptxToPresentation(f.path)
          // Create a Media record for PPTX
          const prisma = getPrisma()
          const pptxMedia = await prisma.media.create({
            data: {
              name: result.originalName,
              type: 'PPTX',
              format: 'pptx',
              filePath: `presentation://${result.presentationId}`,
              fileSize: fs.statSync(f.path).size,
              folder: undefined,
              presentationId: result.presentationId,
              thumbnail: result.slideMediaRecords[0]?.thumbnail ?? null
            }
          })
          return [pptxMedia]
        }
        return [await this.mediaService.importFileFromMulter(f, body.folder)]
      })
    )
    return results.flat()
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 1 })
  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async importClipboardImage({
    file,
    body
  }: RequestHandler<{ mimeType: string; folder?: string }, Express.Multer.File>) {
    if (!file) throw new Error('No se recibió la imagen del portapapeles')
    return await this.mediaService.importFileFromMulter(file, body.folder)
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 10 })
  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async importPdf({
    file,
    files,
    body
  }: RequestHandler<{ folder?: string }, Express.Multer.File>) {
    const targetFiles = file ? [file] : (files ?? [])
    const results = await Promise.all(
      targetFiles.map(async (f) => [await this.mediaService.importPdfFromMulter(f, body.folder)])
    )
    return results.flat()
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 10 })
  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async importPptx({
    file,
    files,
    body
  }: RequestHandler<{ folder?: string }, Express.Multer.File>) {
    const targetFiles = file ? [file] : (files ?? [])
    const results = await Promise.all(
      targetFiles.map(async (f) => {
        const result = await importPptxToPresentation(f.path)
        const prisma = getPrisma()
        const pptxMedia = await prisma.media.create({
          data: {
            name: result.originalName,
            type: 'PPTX',
            format: 'pptx',
            filePath: `presentation://${result.presentationId}`,
            fileSize: fs.statSync(f.path).size,
            folder: undefined,
            presentationId: result.presentationId,
            thumbnail: result.slideMediaRecords[0]?.thumbnail ?? null
          }
        })
        return [pptxMedia]
      })
    )
    return results.flat()
  }

  @UpdateQueryKey(['folders'])
  async createFolder({ body }: RequestHandler<{ folderPath: string }>) {
    return await this.mediaService.createFolder(body.folderPath)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async deleteFolder({ body }: RequestHandler<{ folderPath: string }>) {
    return await this.mediaService.deleteFolder(body.folderPath)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async renamePath({ body }: RequestHandler<{ oldPath: string; newName: string }>) {
    return await this.mediaService.renamePath(body.oldPath, body.newName)
  }

  async listFolders({ body }: RequestHandler<{ parentFolder?: string }>) {
    return await this.mediaService.listFolders(body.parentFolder)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async movePath({ body }: RequestHandler<{ sourcePath: string; targetFolder: string | null }>) {
    return await this.mediaService.movePath(body.sourcePath, body.targetFolder)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async copyFile({
    body
  }: RequestHandler<{ sourcePath: string; targetFolder: string | null; isFolder: boolean }>) {
    return await this.mediaService.copyFile(body.sourcePath, body.targetFolder, body.isFolder)
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 1 })
  @UpdateQueryKey(['media'], ['mediaByIds'], ['folders'])
  async extractZipMp4({ file, body }: RequestHandler<{ folder?: string }, Express.Multer.File>) {
    if (!file) throw new Error('No se recibió el archivo ZIP')
    const result = await this.mediaService.extractZipMp4(file.path, body.folder, file.originalname)
    // Clean up temp file from multer
    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path) } catch { /* ignore */ }
    return result
  }

  async cleanupTempPath({ body }: RequestHandler<{ targetPath: string }>) {
    return await this.mediaService.cleanupTempPath(body.targetPath)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'])
  async update({ body }: RequestHandler<{ id: string; data: UpdateMediaDto }>) {
    return await this.mediaService.update(parseInt(body.id), body.data)
  }

  @UpdateQueryKey(['media'], ['mediaByIds'])
  async deleteFile({ body }: RequestHandler<{ id: number }>) {
    return await this.mediaService.deleteFile(body.id)
  }

  async getMediaByIds({ body }: RequestHandler<{ ids: number[] }>) {
    return await this.mediaService.getMediaByIds(body.ids)
  }

  async verifyFiles() {
    return await this.mediaService.verifyFiles()
  }

  async cleanupOrphans() {
    return await this.mediaService.cleanupOrphans()
  }
}
