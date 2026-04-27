import { MediaService } from './media.service'
import { CreateMediaDto, UpdateMediaDto, MediaFilterDto } from './media.dto'

export class MediaController {
  private mediaService = new MediaService()

  async create(data: CreateMediaDto) {
    return await this.mediaService.create(data)
  }

  async findAll(filter: MediaFilterDto) {
    return await this.mediaService.findAll(filter)
  }

  async findOne(id: string) {
    return await this.mediaService.findOne(parseInt(id))
  }

  async findByFilePath(data: { filePath: string }) {
    return await this.mediaService.findByFilePath(data.filePath)
  }

  async importFile(data: { sourcePath: string; folder?: string }) {
    return await this.mediaService.importFile(data.sourcePath, data.folder)
  }

  async importClipboardImage(data: { bytes: number[]; mimeType: string; folder?: string }) {
    return await this.mediaService.importClipboardImage(data.bytes, data.mimeType, data.folder)
  }

  async deleteFile(data: { filePath: string; thumbnail?: string | null }) {
    return await this.mediaService.deleteFile(data.filePath, data.thumbnail)
  }

  async createFolder(data: { folderPath: string }) {
    return await this.mediaService.createFolder(data.folderPath)
  }

  async deleteFolder(data: { folderPath: string }) {
    return await this.mediaService.deleteFolder(data.folderPath)
  }

  async renamePath(data: { oldPath: string; newName: string }) {
    return await this.mediaService.renamePath(data.oldPath, data.newName)
  }

  async listFolders(data: { parentFolder?: string }) {
    return await this.mediaService.listFolders(data.parentFolder)
  }

  async movePath(data: { sourcePath: string; targetFolder: string | null }) {
    return await this.mediaService.movePath(data.sourcePath, data.targetFolder)
  }

  async copyFile(data: { sourcePath: string; targetFolder: string | null; isFolder: boolean }) {
    return await this.mediaService.copyFile(data.sourcePath, data.targetFolder, data.isFolder)
  }

  async extractZipMp4(data: { zipPath: string }) {
    return await this.mediaService.extractZipMp4(data.zipPath)
  }

  async cleanupTempPath(data: { targetPath: string }) {
    return await this.mediaService.cleanupTempPath(data.targetPath)
  }

  async update(id: string, data: UpdateMediaDto) {
    return await this.mediaService.update(parseInt(id), data)
  }

  async delete(id: string) {
    return await this.mediaService.delete(parseInt(id))
  }

  async getMediaByIds(data: number[]) {
    return await this.mediaService.getMediaByIds(data)
  }
}
