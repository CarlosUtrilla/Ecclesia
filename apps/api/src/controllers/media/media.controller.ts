import { MediaService } from './media.service'
import { CreateMediaDto, UpdateMediaDto, MediaFilterDto } from './media.dto'
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
    const mediaRecords = await Promise.all(
      targetFiles.map(async (f) => await this.mediaService.importFileFromMulter(f, body.folder))
    )
    return mediaRecords
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

  async extractZipMp4({ body }: RequestHandler<{ zipPath: string }>) {
    return await this.mediaService.extractZipMp4(body.zipPath)
  }

  async cleanupTempPath({ body }: RequestHandler<{ targetPath: string }>) {
    return await this.mediaService.cleanupTempPath(body.targetPath)
  }

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
}
