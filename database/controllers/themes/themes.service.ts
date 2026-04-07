import { getPrisma } from '../../../electron/main/prisma'
import {
  CreateThemeDto,
  ThemeArchiveExportResult,
  ThemeArchiveImportResult,
  ThemeWithMedia,
  UpdateThemeDto
} from './themes.dto'
import { Prisma, MediaType } from '@prisma/client'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import AdmZip from 'adm-zip'
import {
  buildMediaRelativePathFromArchive,
  buildUniqueThemeName,
  ensureZipExtension,
  extractPrimaryFontFamily,
  getCustomFontFamilyFromFileName,
  getMediaFolderFromRelativePath,
  normalizeFontMatchValue,
  sanitizeThemeArchiveBaseName
} from './themeArchive.utils'
import {
  buildFallbackFileName,
  buildThumbnailFileName,
  generateImageThumbnail,
  generateVideoFallback,
  generateVideoThumbnail
} from '../../../electron/main/mediaManager/mediaThumbnails'

type ThemeArchivePayload = {
  version: number
  exportedAt: string
  theme: {
    name: string
    background: string
    backgroundVideoLoop: boolean
    textStyle: Record<string, unknown>
    animationSettings: string
    transitionSettings: string
    previewImage: string
    useDefaultBibleSettings: boolean
    biblePresentationSettings?: Record<string, unknown> | null
  }
  backgroundMedia?: {
    name: string
    type: 'IMAGE' | 'VIDEO'
    format: string
    backgroundAssetPath: string
  } | null
  customFont?: {
    name: string
    fileName: string
    fontAssetPath: string
  } | null
}

export class ThemesService {
  private getUserMediaPath() {
    if (!app) {
      throw new Error('No fue posible resolver la ruta de datos de la aplicación')
    }

    return path.join(app.getPath('userData'), 'media')
  }

  private parseTextStyle(textStyle: string | null | undefined) {
    if (!textStyle) return {}

    try {
      return JSON.parse(textStyle)
    } catch {
      return {}
    }
  }

  private async buildArchivePayload(theme: {
    name: string
    background: string
    backgroundVideoLoop: boolean
    textStyle: string
    animationSettings: string
    transitionSettings: string
    previewImage: string
    useDefaultBibleSettings: boolean
    biblePresentationSettings: Record<string, unknown> | null
    backgroundMedia?: {
      filePath: string
      name: string
      type: 'IMAGE' | 'VIDEO'
      format: string
    } | null
  }): ThemeArchivePayload {
    const payload: ThemeArchivePayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: {
        name: theme.name,
        background: theme.background,
        backgroundVideoLoop: theme.backgroundVideoLoop,
        textStyle: this.parseTextStyle(theme.textStyle) as Record<string, unknown>,
        animationSettings: theme.animationSettings,
        transitionSettings: theme.transitionSettings,
        previewImage: theme.previewImage,
        useDefaultBibleSettings: theme.useDefaultBibleSettings,
        biblePresentationSettings: theme.biblePresentationSettings ?? null
      },
      backgroundMedia: null,
      customFont: null
    }

    if (theme.backgroundMedia) {
      const extension = path.extname(theme.backgroundMedia.filePath) || `.${theme.backgroundMedia.format}`
      const originalRelativePath = theme.backgroundMedia.filePath.replace(/\\/g, '/')
      payload.backgroundMedia = {
        name: theme.backgroundMedia.name,
        type: theme.backgroundMedia.type,
        format: theme.backgroundMedia.format,
        backgroundAssetPath: originalRelativePath.length > 0 ? originalRelativePath : `assets/background${extension}`
      }
    }

    const primaryFontFamily = extractPrimaryFontFamily(payload.theme.textStyle.fontFamily)
    if (primaryFontFamily) {
      const prisma = getPrisma()
      const availableFonts = await prisma.font.findMany({
        where: { deletedAt: null },
        select: { name: true, fileName: true, filePath: true }
      })

      const normalizedRequestedFamily = normalizeFontMatchValue(primaryFontFamily)
      const fontMatch = availableFonts.find((font) => {
        const candidates = [
          font.name,
          path.parse(font.fileName).name,
          getCustomFontFamilyFromFileName(font.fileName)
        ]

        return candidates
          .map((candidate) => normalizeFontMatchValue(candidate))
          .some((candidate) => candidate === normalizedRequestedFamily)
      })

      if (fontMatch) {
        payload.customFont = {
          name: fontMatch.name,
          fileName: fontMatch.fileName,
          fontAssetPath: fontMatch.filePath.replace(/\\/g, '/')
        }
      }
    }

    return payload
  }

  private resolveAnimationSettings(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback
  }

  private resolvePreviewImage(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : '#000000'
  }

  private resolveBackground(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : '#000000'
  }

  async createTheme(rawData: CreateThemeDto) {
    const prisma = getPrisma()
    const { biblePresentationSettings, ...data } = rawData

    if (biblePresentationSettings) {
      const createdSettings = await prisma.biblePresentationSettings.create({
        data: biblePresentationSettings
      })
      data.biblePresentationSettingsId = createdSettings.id
    }
    try {
      return await prisma.themes.create({
        data: {
          ...data,
          textStyle: JSON.stringify(data.textStyle)
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tema con el nombre "${data.name}"`)
        }
      }
      throw error
    }
  }

  async getAllThemes(): Promise<ThemeWithMedia[]> {
    const prisma = getPrisma()
    const themes = await prisma.themes.findMany({
      where: { deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return themes.map((theme) => ({
      ...theme,
      textStyle: theme.textStyle ? JSON.parse(theme.textStyle) : {}
    }))
  }

  async getThemeById(id: number): Promise<ThemeWithMedia> {
    const prisma = getPrisma()
    const theme = await prisma.themes.findFirst({
      where: { id, deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })
    if (!theme) {
      throw new Error(`Tema con id ${id} no encontrado`)
    }
    return {
      ...theme,
      textStyle: theme?.textStyle ? JSON.parse(theme.textStyle) : {}
    }
  }

  async getThemeByName(name: string): Promise<ThemeWithMedia> {
    const prisma = getPrisma()
    const theme = await prisma.themes.findFirst({
      where: { name, deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })

    if (!theme) {
      throw new Error(`Tema con nombre ${name} no encontrado`)
    }
    return {
      ...theme,
      textStyle: theme?.textStyle ? JSON.parse(theme.textStyle) : {}
    }
  }

  async updateTheme(id: number, rawData: UpdateThemeDto) {
    const prisma = getPrisma()
    const { biblePresentationSettings, ...data } = rawData

    if (biblePresentationSettings) {
      if (data.biblePresentationSettingsId) {
        // Actualizar configuración existente
        await prisma.biblePresentationSettings.update({
          where: { id: data.biblePresentationSettingsId },
          data: biblePresentationSettings
        })
      } else {
        // Crear nueva configuración
        const createdSettings = await prisma.biblePresentationSettings.create({
          data: biblePresentationSettings
        })
        data.biblePresentationSettingsId = createdSettings.id
      }
    }
    try {
      return await prisma.themes.update({
        where: { id },
        data: {
          ...data,
          textStyle: JSON.stringify(data.textStyle)
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tema con el nombre "${data.name}"`)
        }
      }
      throw error
    }
  }

  async deleteTheme(id: number) {
    const prisma = getPrisma()
    return await prisma.themes.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  async exportThemeToZip(id: number): Promise<ThemeArchiveExportResult> {
    const prisma = getPrisma()
    const theme = await prisma.themes.findFirst({
      where: { id, deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })

    if (!theme) {
      throw new Error('No se encontró el tema a exportar')
    }

    const downloadsPath = app.getPath('downloads')
    const safeBaseName = sanitizeThemeArchiveBaseName(theme.name)
    const archivePath = ensureZipExtension(path.join(downloadsPath, `${safeBaseName}.zip`))

    const payload = await this.buildArchivePayload({
      name: theme.name,
      background: theme.background,
      backgroundVideoLoop: theme.backgroundVideoLoop,
      textStyle: theme.textStyle,
      animationSettings: theme.animationSettings,
      transitionSettings: theme.transitionSettings,
      previewImage: theme.previewImage,
      useDefaultBibleSettings: theme.useDefaultBibleSettings,
      biblePresentationSettings: theme.biblePresentationSettings,
      backgroundMedia: theme.backgroundMedia
        ? {
            filePath: theme.backgroundMedia.filePath,
            name: theme.backgroundMedia.name,
            type: theme.backgroundMedia.type,
            format: theme.backgroundMedia.format
          }
        : null
    })

    const zip = new AdmZip()
    zip.addFile('theme.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'))

    if (theme.backgroundMedia && payload.backgroundMedia?.backgroundAssetPath) {
      const mediaPath = path.join(this.getUserMediaPath(), theme.backgroundMedia.filePath)
      if (fs.existsSync(mediaPath)) {
        zip.addFile(payload.backgroundMedia.backgroundAssetPath, fs.readFileSync(mediaPath))
      }
    }

    if (payload.customFont?.fontAssetPath) {
      const fontPath = path.join(this.getUserMediaPath(), payload.customFont.fontAssetPath)
      if (fs.existsSync(fontPath)) {
        zip.addFile(payload.customFont.fontAssetPath, fs.readFileSync(fontPath))
      }
    }

    zip.writeZip(archivePath)

    return {
      outputPath: archivePath,
      themeName: theme.name,
      hasBackgroundMedia: Boolean(theme.backgroundMedia)
    }
  }

  async importThemeFromZip(zipPath: string): Promise<ThemeArchiveImportResult> {
    const prisma = getPrisma()
    if (!zipPath.toLowerCase().endsWith('.zip')) {
      throw new Error('El archivo seleccionado no es un ZIP válido')
    }

    if (!fs.existsSync(zipPath)) {
      throw new Error('No se encontró el archivo ZIP seleccionado')
    }

    const zip = new AdmZip(zipPath)
    const themeEntry = zip.getEntry('theme.json')
    if (!themeEntry) {
      throw new Error('El ZIP no contiene el archivo theme.json')
    }

    let payload: ThemeArchivePayload
    try {
      payload = JSON.parse(themeEntry.getData().toString('utf8')) as ThemeArchivePayload
    } catch {
      throw new Error('No se pudo leer theme.json del ZIP')
    }

    if (!payload?.theme?.name) {
      throw new Error('El ZIP no contiene datos válidos de tema')
    }

    const existingNames = await prisma.themes.findMany({
      select: { name: true }
    })
    const themeName = buildUniqueThemeName(
      String(payload.theme.name),
      existingNames.map((theme) => theme.name)
    )

    let importedBackgroundMediaId: number | null = null
    let importedBackgroundMediaPath: string | undefined
    let importedBackgroundMediaWasRenamed = false
    if (payload.backgroundMedia?.backgroundAssetPath) {
      const mediaEntry = zip.getEntry(payload.backgroundMedia.backgroundAssetPath)
      if (!mediaEntry) {
        throw new Error('El ZIP indica un fondo, pero no incluye el archivo de medios')
      }

      const mediaBuffer = mediaEntry.getData()
      const extension =
        path.extname(payload.backgroundMedia.backgroundAssetPath) || `.${payload.backgroundMedia.format}`
      const baseRelativePath = buildMediaRelativePathFromArchive(
        payload.backgroundMedia.backgroundAssetPath,
        themeName,
        extension
      )

      const parsedBase = path.posix.parse(baseRelativePath)
      let relativePath = baseRelativePath
      let absolutePath = path.join(this.getUserMediaPath(), ...baseRelativePath.split('/'))

      const baseFileName = parsedBase.name || sanitizeThemeArchiveBaseName(themeName)
      const baseExtension = parsedBase.ext || extension

      let renameAttempt = 0
      while (true) {
        const existingByPath = await prisma.media.findUnique({ where: { filePath: relativePath } })
        if (!existingByPath && !fs.existsSync(absolutePath)) {
          break
        }

        renameAttempt += 1
        importedBackgroundMediaWasRenamed = true
        const suffix = renameAttempt === 1 ? ' (importado)' : ` (importado ${renameAttempt})`
        const nextFileName = `${baseFileName}${suffix}${baseExtension}`
        relativePath = path.posix.join(parsedBase.dir, nextFileName)
        absolutePath = path.join(this.getUserMediaPath(), ...relativePath.split('/'))
      }

      fs.mkdirSync(path.dirname(absolutePath), { recursive: true })

      fs.writeFileSync(absolutePath, mediaBuffer)

        const thumbHash = crypto.randomBytes(8).toString('hex')
        const thumbBaseName = path.basename(absolutePath, path.extname(absolutePath))
        const thumbnailsDir = path.join(this.getUserMediaPath(), 'thumbnails')
        fs.mkdirSync(thumbnailsDir, { recursive: true })

        const thumbnailFileName = buildThumbnailFileName(thumbBaseName, thumbHash)
        const thumbnailAbsPath = path.join(thumbnailsDir, thumbnailFileName)

        let fallbackFileName: string | undefined

        if (payload.backgroundMedia.type === MediaType.IMAGE) {
          await generateImageThumbnail(absolutePath, thumbnailAbsPath)
        } else {
          await generateVideoThumbnail(absolutePath, thumbnailAbsPath)
          fallbackFileName = buildFallbackFileName(thumbBaseName, thumbHash)
          const fallbackAbsPath = path.join(thumbnailsDir, fallbackFileName)
          await generateVideoFallback(absolutePath, fallbackAbsPath)
        }

        const mediaFolder = getMediaFolderFromRelativePath(relativePath)

        const createdMedia = await prisma.media.create({
          data: {
            name: payload.backgroundMedia.name || themeName,
            type: payload.backgroundMedia.type,
            format: payload.backgroundMedia.format,
            filePath: relativePath,
            fileSize: mediaBuffer.length,
            folder: mediaFolder,
            thumbnail: `thumbnails/${thumbnailFileName}`,
            fallback: fallbackFileName ? `thumbnails/${fallbackFileName}` : undefined
          }
        })

        importedBackgroundMediaId = createdMedia.id
        importedBackgroundMediaPath = relativePath
      }

      if (payload.customFont?.fontAssetPath) {
        const fontEntry = zip.getEntry(payload.customFont.fontAssetPath)
        if (!fontEntry) {
          throw new Error('El ZIP indica una fuente personalizada, pero no incluye el archivo')
        }

        const rawFileName = payload.customFont.fileName || path.posix.basename(payload.customFont.fontAssetPath)
        const safeFileName = path.posix.basename(rawFileName).trim()
        if (!safeFileName) {
          throw new Error('El ZIP contiene una fuente personalizada inválida')
        }

        const fontRelativePath = `fonts/${safeFileName}`
        const fontAbsolutePath = path.join(this.getUserMediaPath(), 'fonts', safeFileName)

        const existingFont = await prisma.font.findFirst({
          where: {
            deletedAt: null,
            OR: [{ fileName: safeFileName }, { filePath: fontRelativePath }]
          },
          select: { id: true }
        })

        const fontExistsInFileSystem = fs.existsSync(fontAbsolutePath)

        if (!fontExistsInFileSystem) {
          fs.mkdirSync(path.dirname(fontAbsolutePath), { recursive: true })
          fs.writeFileSync(fontAbsolutePath, fontEntry.getData())
        }

        if (!existingFont) {
          const fallbackName = getCustomFontFamilyFromFileName(safeFileName) || path.parse(safeFileName).name
          await prisma.font.create({
            data: {
              name: payload.customFont.name || fallbackName,
              fileName: safeFileName,
              filePath: fontRelativePath
            }
          })

          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('font-added')
          })
        }
      }

      let biblePresentationSettingsId: number | null = null
    if (!payload.theme.useDefaultBibleSettings && payload.theme.biblePresentationSettings) {
      const createdSettings = await prisma.biblePresentationSettings.create({
        data: payload.theme.biblePresentationSettings as Prisma.BiblePresentationSettingsUncheckedCreateInput
      })
      biblePresentationSettingsId = createdSettings.id
    }

    let resolvedThemeName = themeName
    let createdTheme: Awaited<ReturnType<typeof prisma.themes.create>> | null = null

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        createdTheme = await prisma.themes.create({
          data: {
            name: resolvedThemeName,
            background: this.resolveBackground(payload.theme.background),
            backgroundVideoLoop: payload.theme.backgroundVideoLoop ?? true,
            backgroundMediaId: importedBackgroundMediaId,
            textStyle: JSON.stringify(payload.theme.textStyle ?? {}),
            animationSettings: this.resolveAnimationSettings(
              payload.theme.animationSettings,
              '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}'
            ),
            transitionSettings: this.resolveAnimationSettings(
              payload.theme.transitionSettings,
              '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}'
            ),
            previewImage: this.resolvePreviewImage(payload.theme.previewImage),
            useDefaultBibleSettings: payload.theme.useDefaultBibleSettings ?? true,
            biblePresentationSettingsId
          }
        })
        break
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error
        }

        const refreshedNames = await prisma.themes.findMany({
          select: { name: true }
        })
        resolvedThemeName = buildUniqueThemeName(
          String(payload.theme.name),
          refreshedNames.map((theme) => theme.name)
        )
      }
    }

    if (!createdTheme) {
      throw new Error('No se pudo crear el tema importado por conflicto de nombre')
    }

    return {
      themeId: createdTheme.id,
      themeName: createdTheme.name,
      hasBackgroundMedia: importedBackgroundMediaId !== null,
      backgroundMediaFilePath: importedBackgroundMediaPath,
      backgroundMediaWasRenamed: importedBackgroundMediaWasRenamed
    }
  }
}
