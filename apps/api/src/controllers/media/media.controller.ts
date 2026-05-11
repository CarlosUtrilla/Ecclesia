import { MediaService } from './media.service'
import { CreateMediaDto, UpdateMediaDto, MediaFilterDto } from './media.dto'
import { RequestHandler } from '../../utils/RequestHandler'

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

  async importFile({ body }: RequestHandler<{ sourcePath: string; folder?: string }>) {
    return await this.mediaService.importFile(body.sourcePath, body.folder)
  }

  async importClipboardImage({
    body
  }: RequestHandler<{ bytes: number[]; mimeType: string; folder?: string }>) {
    return await this.mediaService.importClipboardImage(body.bytes, body.mimeType, body.folder)
  }

  async createFolder({ body }: RequestHandler<{ folderPath: string }>) {
    return await this.mediaService.createFolder(body.folderPath)
  }

  async deleteFolder({ body }: RequestHandler<{ folderPath: string }>) {
    return await this.mediaService.deleteFolder(body.folderPath)
  }

  async renamePath({ body }: RequestHandler<{ oldPath: string; newName: string }>) {
    return await this.mediaService.renamePath(body.oldPath, body.newName)
  }

  async listFolders({ body }: RequestHandler<{ parentFolder?: string }>) {
    return await this.mediaService.listFolders(body.parentFolder)
  }

  async movePath({ body }: RequestHandler<{ sourcePath: string; targetFolder: string | null }>) {
    return await this.mediaService.movePath(body.sourcePath, body.targetFolder)
  }

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

  async deleteFile({ body }: RequestHandler<{ id: number }>) {
    return await this.mediaService.deleteFile(body.id)
  }

  async getMediaByIds({ body }: RequestHandler<{ ids: number[] }>) {
    return await this.mediaService.getMediaByIds(body.ids)
  }
}
