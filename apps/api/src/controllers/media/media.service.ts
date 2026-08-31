import { getPrisma } from '../../prisma'
import { CreateMediaDto, UpdateMediaDto, MediaDto, MediaListDto, MediaFilterDto, VerifyMediaResult, VerifyMediaEntry } from './media.dto'
import fs from 'fs'
import path from 'path'
import {
  cleanupTempPath,
  copyMediaSource,
  createMediaFolder,
  extractZipMp4,
  importMediaFromSourcePath,
  importClipboardImage,
  importPdfPages,
  listMediaFolders,
  moveMediaPath,
  renameMediaPath,
  normalizeMediaPath,
  resolveNormalizedPath
} from './media.storage'
import { resolveFilesRoot, resolveMediaRoot, resolveThumbnailsRoot } from '../../config'
import {
  PDF_PRESENTATION_TITLE_PREFIX,
  PPTX_PRESENTATION_TITLE_PREFIX
} from '../presentations/importedPresentationTitle'
import { createDocumentPresentation, getPptxRasterizer } from './documentImport'

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

    // Salvo que se pidan PDFs o PPTXs explícitamente, se ocultan las imágenes
    // internas de página/diapositiva.
    //
    // Las dos condiciones van en AND: en OR la expresión era una tautología
    // (una carpeta `__pdf/x` incumple la primera pero cumple la segunda), así
    // que ninguna imagen interna llegaba a ocultarse. El `folder: null` sí va
    // en OR porque `NOT startsWith` sobre columna nullable descarta los nulos
    // por la lógica ternaria de SQL.
    if (type !== 'PDF' && type !== 'PPTX') {
      where.AND = [
        {
          OR: [
            { folder: null },
            {
              AND: [
                { folder: { not: { startsWith: '__pdf/' } } },
                { folder: { not: { startsWith: '__pptx/' } } }
              ]
            }
          ]
        }
      ]
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
    const deletedAt = new Date()

    // La Presentation de un PDF/PPTX pertenece a su Media: sin este borrado quedaría viva
    // y, al purgarse el Media, huérfana y visible en la biblioteca de presentaciones.
    if (mediaData?.presentationId) {
      await prisma.presentation.update({
        where: { id: mediaData.presentationId },
        data: { deletedAt }
      })
    }

    return await prisma.media.update({
      where: { id },
      data: { deletedAt }
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

  async importPdfFromMulter(file: Express.Multer.File, _folder?: string): Promise<MediaDto> {
    const prisma = getPrisma()
    const { pages, pdfFileSize, originalName } = await importPdfPages(file.path, undefined, file.originalname)

    // 1. Create Media records for each page image (IMAGE type, in __pdf/ hidden folder)
    const pageMediaIds = await Promise.all(
      pages.map(async (page) => {
        const { width, height, ...fileData } = page
        const media = await prisma.media.create({
          data: { ...fileData, width, height }
        })
        return media.id
      })
    )

    // 2. Create a Presentation with one slide per page
    const slides = pageMediaIds.map((mediaId, idx) => ({
      id: `slide-${idx}`,
      type: 'MEDIA' as const,
      mediaId,
      items: [{
        id: `item-${idx}-0`,
        type: 'MEDIA' as const,
        accessData: String(mediaId),
        layer: 0
      }]
    }))

    const presentation = await prisma.presentation.create({
      data: {
        title: `${PDF_PRESENTATION_TITLE_PREFIX}${originalName}`,
        slides: JSON.stringify(slides)
      }
    })

    // 3. Create a single PDF-type Media record linking to the presentation
    // Use the first page's thumbnail as the PDF thumbnail
    const pdfMedia = await prisma.media.create({
      data: {
        name: originalName,
        type: 'PDF',
        format: 'pdf',
        filePath: `presentation://${presentation.id}`,
        fileSize: pdfFileSize,
        folder: undefined,
        presentationId: presentation.id,
        thumbnail: pages[0]?.thumbnail ?? null
      }
    })

    return pdfMedia
  }

  /**
   * Importa un PPTX rasterizando cada diapositiva a PNG.
   *
   * El rasterizador lo inyecta el proceso principal (`setPptxRasterizer`),
   * porque necesita una ventana de Electron para pintar el DOM que produce
   * `@aiden0z/pptx-renderer`.
   */
  async importPptxFromMulter(file: Express.Multer.File, _folder?: string): Promise<MediaDto> {
    const rasterize = getPptxRasterizer()
    const pages = await rasterize(file.path)
    if (pages.length === 0) {
      throw new Error('El PPTX no tiene diapositivas visibles que importar')
    }

    return await createDocumentPresentation({
      sourcePath: file.path,
      originalFileName: file.originalname,
      format: 'pptx',
      mediaType: 'PPTX',
      hiddenFolderPrefix: '__pptx',
      titlePrefix: PPTX_PRESENTATION_TITLE_PREFIX,
      pageLabel: 'diapositiva',
      // Se conserva el original para poder re-rasterizar a mayor escala mas
      // adelante sin volver a pedirle el archivo al usuario.
      keepSourceCopy: true,
      pages
    })
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

  async extractZipMp4(zipPath: string, folder?: string, originalName?: string) {
    const { tempDir, mp4Paths } = extractZipMp4(zipPath, originalName)
    const importedMedia = await Promise.all(
      mp4Paths.map(async (mp4Path) => {
        return await this.importFileFromMulter({
          path: mp4Path,
          originalname: path.basename(mp4Path),
          fieldname: 'file',
          encoding: '7bit',
          mimetype: 'video/mp4',
          size: fs.statSync(mp4Path).size,
          destination: path.dirname(mp4Path),
          filename: path.basename(mp4Path),
          buffer: Buffer.alloc(0),
          stream: fs.createReadStream(mp4Path)
        }, folder)
      })
    )
    // Clean up extraction temp dir
    try { cleanupTempPath(tempDir) } catch { /* ignore */ }
    return importedMedia
  }

  async cleanupTempPath(targetPath: string) {
    return cleanupTempPath(targetPath)
  }

  async verifyFiles(): Promise<VerifyMediaResult> {
    const prisma = getPrisma()
    const mediaRoot = resolveMediaRoot()
    const allMedia = await prisma.media.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        filePath: true,
        thumbnail: true,
        fallback: true
      }
    })

    const details: VerifyMediaEntry[] = []
    let missingFiles = 0
    let missingThumbnails = 0
    let missingFallbacks = 0

    for (const media of allMedia) {
      const fileExists = media.filePath
        ? fs.existsSync(resolveNormalizedPath(mediaRoot, normalizeMediaPath(media.filePath)))
        : true
      const thumbnailExists = media.thumbnail
        ? fs.existsSync(resolveNormalizedPath(mediaRoot, normalizeMediaPath(media.thumbnail)))
        : true
      const fallbackExists = media.fallback
        ? fs.existsSync(resolveNormalizedPath(mediaRoot, normalizeMediaPath(media.fallback)))
        : true

      if (!fileExists) missingFiles++
      if (!thumbnailExists) missingThumbnails++
      if (!fallbackExists) missingFallbacks++

      details.push({
        id: media.id,
        name: media.name,
        type: media.type,
        filePath: media.filePath,
        thumbnail: media.thumbnail,
        fallback: media.fallback,
        fileExists,
        thumbnailExists,
        fallbackExists
      })
    }

    const missing = details.filter(
      (d) => !d.fileExists || !d.thumbnailExists || !d.fallbackExists
    ).length

    return {
      total: allMedia.length,
      present: allMedia.length - missing,
      missing,
      missingFiles,
      missingThumbnails,
      missingFallbacks,
      details
    }
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
