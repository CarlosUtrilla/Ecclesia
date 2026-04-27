import { getPrisma } from '../../../electron/main/prisma'
import { CreateMediaDto, UpdateMediaDto, MediaDto, MediaListDto, MediaFilterDto } from './media.dto'
import {
  cleanupTempPath,
  copyMediaSource,
  createMediaFolder,
  deleteMediaFile,
  deleteMediaFolder,
  extractZipMp4,
  importClipboardImage,
  importMediaFromSourcePath,
  listMediaFolders,
  moveMediaPath,
  renameMediaPath
} from './media.storage'

export class MediaService {
  async create(data: CreateMediaDto): Promise<MediaDto> {
    const prisma = getPrisma()
    return await prisma.media.create({
      data
    })
  }

  async findAll(filter: MediaFilterDto = {}): Promise<MediaListDto> {
    const prisma = getPrisma()
    const { type, search, page = 1, limit = 50 } = filter
    const skip = (page - 1) * limit

    const where: any = { deletedAt: null }

    if (type) {
      where.type = type
    }

    if (search) {
      where.name = {
        contains: search
      }
    }

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.media.count({ where })
    ])

    return { items, total }
  }

  async findOne(id: number): Promise<MediaDto | null> {
    const prisma = getPrisma()
    return await prisma.media.findUnique({
      where: { id }
    })
  }

  async findByFilePath(filePath: string): Promise<MediaDto | null> {
    const prisma = getPrisma()
    return await prisma.media.findUnique({
      where: { filePath }
    })
  }

  async update(id: number, data: UpdateMediaDto): Promise<MediaDto> {
    const prisma = getPrisma()
    return await prisma.media.update({
      where: { id },
      data
    })
  }

  async delete(id: number): Promise<MediaDto> {
    const prisma = getPrisma()
    return await prisma.media.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  async getMediaByIds(ids: number[]): Promise<MediaDto[]> {
    const prisma = getPrisma()
    return await prisma.media.findMany({
      where: {
        deletedAt: null,
        id: {
          in: ids
        }
      }
    })
  }

  async importFile(sourcePath: string, folder?: string) {
    return await importMediaFromSourcePath(sourcePath, folder)
  }

  async importClipboardImage(bytes: number[], mimeType: string, folder?: string) {
    return await importClipboardImage(bytes, mimeType, folder)
  }

  async deleteFile(filePath: string, thumbnail?: string | null) {
    return deleteMediaFile(filePath, thumbnail)
  }

  async createFolder(folderPath: string) {
    return createMediaFolder(folderPath)
  }

  async deleteFolder(folderPath: string) {
    return deleteMediaFolder(folderPath)
  }

  async renamePath(oldPath: string, newName: string) {
    return renameMediaPath(oldPath, newName)
  }

  async listFolders(parentFolder?: string) {
    return listMediaFolders(parentFolder)
  }

  async movePath(sourcePath: string, targetFolder: string | null) {
    return moveMediaPath(sourcePath, targetFolder)
  }

  async copyFile(sourcePath: string, targetFolder: string | null, isFolder: boolean) {
    return copyMediaSource(sourcePath, targetFolder, isFolder)
  }

  async extractZipMp4(zipPath: string) {
    return extractZipMp4(zipPath)
  }

  async cleanupTempPath(targetPath: string) {
    return cleanupTempPath(targetPath)
  }
}
