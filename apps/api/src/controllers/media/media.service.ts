import { getPrisma } from '../../prisma'
import { CreateMediaDto, UpdateMediaDto, MediaDto, MediaListDto, MediaFilterDto } from './media.dto'
import fs from 'fs'
import path from 'path'
import {
  cleanupTempPath,
  copyMediaSource,
  createMediaFolder,
  extractZipMp4,
  importMediaFromSourcePath,
  importClipboardImage,
  listMediaFolders,
  moveMediaPath,
  renameMediaPath,
  normalizeMediaPath,
  resolveNormalizedPath
} from './media.storage'
import { resolveFilesRoot, resolveMediaRoot, resolveThumbnailsRoot } from '../../config'

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

  async deleteFile(id: number): Promise<MediaDto> {
    const mediaData = await this.findOne(id)
    const mediaRoot = resolveMediaRoot()

    const filePath = mediaData?.filePath
    const thumbnail = mediaData?.thumbnail
    const fallback = mediaData?.fallback

    if (filePath) {
      const fileFullPath = resolveNormalizedPath(mediaRoot, normalizeMediaPath(filePath))

      if (fs.existsSync(fileFullPath)) {
        fs.unlinkSync(fileFullPath)
      }
    } else {
      throw new Error('Media file path not found for deletion')
    }

    if (thumbnail) {
      const thumbnailFullPath = resolveNormalizedPath(mediaRoot, normalizeMediaPath(thumbnail))
      if (fs.existsSync(thumbnailFullPath)) {
        fs.unlinkSync(thumbnailFullPath)
      }
    }

    if (fallback) {
      const fallbackFullPath = resolveNormalizedPath(mediaRoot, normalizeMediaPath(fallback))
      if (fs.existsSync(fallbackFullPath)) {
        fs.unlinkSync(fallbackFullPath)
      }
    }

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

  async importFileFromMulter(file: Express.Multer.File, folder?: string): Promise<MediaDto> {
    const fileData = await importMediaFromSourcePath(file.path, folder, file.originalname)
    const media = await getPrisma().media.create({ data: fileData })
    return media
  }

  async importClipboardFromBytes(
    bytes: number[],
    mimeType: string,
    folder?: string
  ): Promise<MediaDto> {
    const fileData = await importClipboardImage(bytes, mimeType, folder)
    const media = await getPrisma().media.create({ data: fileData })
    return media
  }

  async createFolder(folderPath: string) {
    const normalizedFolder = normalizeMediaPath(folderPath)
    const parts = normalizedFolder.split('/')
    const newFolderName = parts[parts.length - 1]
    const parentFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined

    // Check for name collision and auto-rename like OS explorer
    const siblings = listMediaFolders(parentFolder)
    let finalName = newFolderName
    let counter = 1
    while (siblings.includes(finalName)) {
      finalName = `${newFolderName} (${counter})`
      counter++
    }

    const finalPath = parentFolder ? `${parentFolder}/${finalName}` : finalName
    return createMediaFolder(finalPath)
  }

  async deleteFolder(folderPath: string) {
    const prisma = getPrisma()
    const filesRoot = resolveFilesRoot()
    const normalizedFolder = normalizeMediaPath(folderPath)

    // Buscar todos los medios dentro de esta carpeta recursivamente
    const folderFilter = normalizedFolder
      ? {
          OR: [{ folder: normalizedFolder }, { folder: { startsWith: `${normalizedFolder}/` } }]
        }
      : { folder: null }

    const mediaInsideFolder = await prisma.media.findMany({
      where: {
        ...folderFilter,
        deletedAt: null
      }
    })

    for (const mediaItem of mediaInsideFolder) {
      await this.deleteFile(mediaItem.id)
    }

    const fullPath = resolveNormalizedPath(filesRoot, normalizedFolder)
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }

    return { success: true }
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

  async cleanupOrphans(): Promise<{
    deletedOrphans: number
    deletedStale: number
    totalFreedBytes: number
    details: Array<{ path: string; reason: string; size: number }>
  }> {
    const prisma = getPrisma()
    const filesRoot = resolveFilesRoot()

    // 1. Leer todos los registros de media (incluyendo soft-delete)
    //    Construir mapa filePath → lista de registros para detectar paths compartidos
    const allMedia = await prisma.media.findMany({
      select: { filePath: true, deletedAt: true, thumbnail: true, fallback: true }
    })

    const recordsByPath = new Map<string, Array<{ deletedAt: Date | null }>>()
    for (const m of allMedia) {
      if (!m.filePath) continue
      const list = recordsByPath.get(m.filePath) || []
      list.push({ deletedAt: m.deletedAt })
      recordsByPath.set(m.filePath, list)
    }

    // 2. Escanear recursivamente media/files/
    const scanFiles = (
      dir: string,
      prefix: string
    ): Array<{ rel: string; abs: string; size: number }> => {
      const results: Array<{ rel: string; abs: string; size: number }> = []
      let entries: string[]
      try {
        entries = fs.readdirSync(dir)
      } catch {
        return results
      }
      for (const entry of entries) {
        const absPath = path.join(dir, entry)
        const relPath = prefix ? `${prefix}/${entry}` : entry
        try {
          const stat = fs.statSync(absPath)
          if (stat.isDirectory()) {
            results.push(...scanFiles(absPath, relPath))
          } else {
            results.push({ rel: relPath, abs: absPath, size: stat.size })
          }
        } catch {
          // skip inaccessible files
        }
      }
      return results
    }

    const diskFiles = scanFiles(filesRoot, '')
    const details: Array<{ path: string; reason: string; size: number }> = []
    let totalFreedBytes = 0

    for (const file of diskFiles) {
      const dbPath = `files/${file.rel.replace(/\\/g, '/')}`
      const records = recordsByPath.get(dbPath)

      if (!records) {
        // Orphan: file on disk but not in DB at all
        details.push({ path: dbPath, reason: 'orphan', size: file.size })
        totalFreedBytes += file.size
        try {
          fs.unlinkSync(file.abs)
        } catch {
          /* skip */
        }
      } else {
        // Verificar si TODOS los registros que usan este path están eliminados
        const allDeleted = records.every((r) => r.deletedAt !== null)
        if (allDeleted) {
          // Todos los registros que referencian este archivo están soft-deleteados
          details.push({ path: dbPath, reason: 'deleted-record', size: file.size })
          totalFreedBytes += file.size
          try {
            fs.unlinkSync(file.abs)
          } catch {
            /* skip */
          }
        }
        // Si algún registro activo usa este path, no se toca
      }
    }

    // 3. Tambien limpiar thumbnails huerfanos
    const scanThumbs = (
      dir: string,
      prefix: string
    ): Array<{ rel: string; abs: string; size: number }> => {
      const results: Array<{ rel: string; abs: string; size: number }> = []
      let entries: string[]
      try {
        entries = fs.readdirSync(dir)
      } catch {
        return results
      }
      for (const entry of entries) {
        const absPath = path.join(dir, entry)
        const relPath = prefix ? `${prefix}/${entry}` : entry
        try {
          const stat = fs.statSync(absPath)
          if (stat.isDirectory()) {
            results.push(...scanThumbs(absPath, relPath))
          } else {
            results.push({ rel: relPath, abs: absPath, size: stat.size })
          }
        } catch {
          // skip
        }
      }
      return results
    }

    const thumbDir = resolveThumbnailsRoot()
    if (fs.existsSync(thumbDir)) {
      const thumbFiles = scanThumbs(thumbDir, '')
      for (const file of thumbFiles) {
        const dbPath = `thumbnails/${file.rel.replace(/\\/g, '/')}`
        const isReferenced = allMedia.some((m) => m.thumbnail === dbPath || m.fallback === dbPath)
        if (!isReferenced) {
          details.push({ path: dbPath, reason: 'orphan-thumbnail', size: file.size })
          totalFreedBytes += file.size
          try {
            fs.unlinkSync(file.abs)
          } catch {
            /* skip */
          }
        }
      }
    }

    const deletedOrphans = details.filter(
      (d) => d.reason === 'orphan' || d.reason === 'orphan-thumbnail'
    ).length
    const deletedStale = details.filter((d) => d.reason === 'deleted-record').length

    return { deletedOrphans, deletedStale, totalFreedBytes, details }
  }
}
