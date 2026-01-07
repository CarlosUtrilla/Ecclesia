import { ipcMain, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { MediaType } from '@prisma/client'
import sharp from 'sharp'
import ffmpeg from '@ffmpeg-installer/ffmpeg'
import { spawn } from 'child_process'

// Formatos soportados
export const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
export const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.webm', '.mov', '.avi']

// Generar thumbnail de imagen con sharp
async function generateImageThumbnail(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath)
    .resize(400, 300, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 80 })
    .toFile(destPath)
}

// Generar thumbnail de video con ffmpeg
function generateVideoThumbnail(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path
    const args = [
      '-i',
      sourcePath,
      '-ss',
      '00:00:01', // Tomar frame en el segundo 1
      '-vframes',
      '1',
      '-vf',
      'scale=400:300:force_original_aspect_ratio=decrease',
      '-q:v',
      '2',
      destPath
    ]

    const process = spawn(ffmpegPath, args)

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    process.on('error', reject)
  })
}

export function registerMediaHandlers() {
  // Abrir diálogo para seleccionar archivos
  ipcMain.handle('media:select-files', async (_event, type: MediaType | 'all') => {
    const filters: any[] = []

    if (type === 'all') {
      filters.push({
        name: 'Medios',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'avi']
      })
    } else if (type === MediaType.IMAGE) {
      filters.push({
        name: 'Imágenes',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
      })
    } else if (type === MediaType.VIDEO) {
      filters.push({
        name: 'Videos',
        extensions: ['mp4', 'webm', 'mov', 'avi']
      })
    }

    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters
    })

    if (result.canceled) {
      return []
    }

    return result.filePaths
  })

  // Importar archivo al directorio de la aplicación
  ipcMain.handle('media:import-file', async (_event, sourcePath: string, folder?: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const filesPath = folder
        ? path.join(userDataPath, 'media', 'files', folder)
        : path.join(userDataPath, 'media', 'files')
      const thumbnailsPath = path.join(userDataPath, 'media', 'thumbnails')

      // Crear directorios si no existen
      if (!fs.existsSync(filesPath)) {
        fs.mkdirSync(filesPath, { recursive: true })
      }
      if (!fs.existsSync(thumbnailsPath)) {
        fs.mkdirSync(thumbnailsPath, { recursive: true })
      }

      // Obtener información del archivo
      const ext = path.extname(sourcePath).toLowerCase()
      const stats = fs.statSync(sourcePath)
      const originalName = path.basename(sourcePath, ext)

      // Generar nombre único
      const hash = crypto.randomBytes(8).toString('hex')
      const newFileName = `${originalName}-${hash}${ext}`
      const destPath = path.join(filesPath, newFileName)

      // Copiar archivo
      fs.copyFileSync(sourcePath, destPath)

      // Determinar tipo
      let type: MediaType
      if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
        type = MediaType.IMAGE
      } else if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
        type = MediaType.VIDEO
      } else {
        throw new Error(`Formato no soportado: ${ext}`)
      }

      // Crear thumbnail optimizado
      const thumbnailFileName = `thumb-${originalName.replaceAll(' ', '_')}-${hash}.jpg` // Siempre JPG para thumbnails
      const thumbnailPath = path.join(thumbnailsPath, thumbnailFileName)

      if (type === MediaType.IMAGE) {
        await generateImageThumbnail(sourcePath, thumbnailPath)
      } else {
        await generateVideoThumbnail(sourcePath, thumbnailPath)
      }

      const filePath = folder ? `files/${folder}/${newFileName}` : `files/${newFileName}`

      return {
        name: originalName,
        type,
        format: ext.slice(1),
        filePath,
        fileSize: stats.size,
        thumbnail: `thumbnails/${thumbnailFileName}`,
        folder: folder || null
      }
    } catch (error: any) {
      console.error('Error al importar archivo:', error)
      throw error
    }
  })

  // Obtener ruta completa de un archivo de media
  ipcMain.handle('media:get-full-path', (_event, fileName: string) => {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'media', fileName)
  })

  // Eliminar archivo físico
  ipcMain.handle(
    'media:delete-file',
    async (_event, filePath: string, thumbnail?: string | null) => {
      try {
        const userDataPath = app.getPath('userData')

        // Eliminar archivo original
        const fileFullPath = path.join(userDataPath, 'media', filePath)
        if (fs.existsSync(fileFullPath)) {
          fs.unlinkSync(fileFullPath)
        }

        // Eliminar thumbnail si existe
        if (thumbnail) {
          const thumbnailFullPath = path.join(userDataPath, 'media', thumbnail)
          if (fs.existsSync(thumbnailFullPath)) {
            fs.unlinkSync(thumbnailFullPath)
          }
        }

        return true
      } catch (error: any) {
        console.error('Error al eliminar archivo:', error)
        throw error
      }
    }
  )

  // Crear carpeta
  ipcMain.handle('media:create-folder', async (_event, folderPath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const fullPath = path.join(userDataPath, 'media', 'files', folderPath)

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }

      return { success: true, path: folderPath }
    } catch (error: any) {
      console.error('Error al crear carpeta:', error)
      throw error
    }
  })

  // Eliminar carpeta
  ipcMain.handle('media:delete-folder', async (_event, folderPath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const fullPath = path.join(userDataPath, 'media', 'files', folderPath)

      if (fs.existsSync(fullPath)) {
        // Verificar que esté vacía
        const files = fs.readdirSync(fullPath)
        if (files.length > 0) {
          throw new Error('La carpeta no está vacía')
        }
        fs.rmdirSync(fullPath)
      }

      return { success: true }
    } catch (error: any) {
      console.error('Error al eliminar carpeta:', error)
      throw error
    }
  })

  // Renombrar archivo o carpeta
  ipcMain.handle(
    'media:rename',
    async (_event, oldPath: string, newName: string, isFolder: boolean) => {
      try {
        const userDataPath = app.getPath('userData')
        const basePath = path.join(userDataPath, 'media', 'files')

        const oldFullPath = path.join(basePath, oldPath)
        const directory = path.dirname(oldPath)
        const newPath = directory === '.' ? newName : path.join(directory, newName)
        const newFullPath = path.join(basePath, newPath)

        if (!fs.existsSync(oldFullPath)) {
          throw new Error('El archivo o carpeta no existe')
        }

        if (fs.existsSync(newFullPath)) {
          throw new Error('Ya existe un archivo o carpeta con ese nombre')
        }

        fs.renameSync(oldFullPath, newFullPath)

        return { success: true, newPath }
      } catch (error: any) {
        console.error('Error al renombrar:', error)
        throw error
      }
    }
  )

  // Listar carpetas
  ipcMain.handle('media:list-folders', async (_event, parentFolder?: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const basePath = path.join(userDataPath, 'media', 'files')
      const targetPath = parentFolder ? path.join(basePath, parentFolder) : basePath

      if (!fs.existsSync(targetPath)) {
        return []
      }

      const items = fs.readdirSync(targetPath, { withFileTypes: true })
      const folders = items.filter((item) => item.isDirectory()).map((item) => item.name)

      return folders
    } catch (error: any) {
      console.error('Error al listar carpetas:', error)
      throw error
    }
  })
}
