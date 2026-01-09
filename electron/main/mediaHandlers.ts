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

// Generar thumbnail de video con ffmpeg (en segundo 1.5 para evitar animaciones iniciales)
function generateVideoThumbnail(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path
    const args = [
      '-i',
      sourcePath,
      '-ss',
      '00:00:01.5', // Tomar frame en el segundo 1.5 para evitar animaciones
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

// Generar imagen de fallback del primer frame del video
function generateVideoFallback(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path
    const args = [
      '-i',
      sourcePath,
      '-ss',
      '00:00:00.1', // Primer frame visible (no el frame 0 que puede estar negro)
      '-vframes',
      '1',
      '-vf',
      'scale=-1:1080:force_original_aspect_ratio=decrease', // Mantener resolución original
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

// Verificar si un video es compatible con Chromium (H.264 baseline/main)
function checkVideoCompatibility(
  sourcePath: string
): Promise<{ compatible: boolean; codec: string; profile: string }> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path
    const args = ['-i', sourcePath, '-hide_banner']

    const process = spawn(ffmpegPath, args)
    let output = ''

    process.stderr.on('data', (data) => {
      output += data.toString()
    })

    process.on('close', () => {
      // Buscar información del codec de video
      const videoMatch = output.match(/Stream #\d+:\d+.*Video: (\w+).*?(\(.*?\))?/i)

      if (!videoMatch) {
        resolve({ compatible: false, codec: 'unknown', profile: 'unknown' })
        return
      }

      const codec = videoMatch[1].toLowerCase()
      const profileInfo = videoMatch[2] || ''

      // Chromium soporta H.264 (baseline, main, high), VP8, VP9
      // Formato MP4 con H.264 es el más compatible
      const compatible =
        (codec === 'h264' &&
          (profileInfo.includes('Baseline') ||
            profileInfo.includes('Main') ||
            profileInfo.includes('High'))) ||
        codec === 'vp8' ||
        codec === 'vp9'

      resolve({
        compatible,
        codec,
        profile: profileInfo.replace(/[()]/g, '').trim()
      })
    })

    process.on('error', reject)
  })
}

// Convertir video a formato MP4 con H.264 (mejor compatibilidad para Electron/Chromium)
function convertVideoToCompatibleFormat(
  sourcePath: string,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path
    const args = [
      '-i',
      sourcePath,
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline', // Máxima compatibilidad
      '-level',
      '3.1', // Mejor que 3.0, soporta hasta 1080p
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '23', // Calidad constante (18-28, 23 es buena calidad)
      '-preset',
      'medium', // Balance entre velocidad y compresión
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart', // Optimizar para streaming web
      '-y', // Sobrescribir archivo de salida
      destPath
    ]

    console.log('Convirtiendo video a MP4 (H.264) para máxima compatibilidad...')
    const process = spawn(ffmpegPath, args)

    let duration = 0
    let currentTime = 0

    process.stderr.on('data', (data) => {
      const output = data.toString()

      // Extraer duración total del video
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
      if (durationMatch) {
        const hours = parseInt(durationMatch[1])
        const minutes = parseInt(durationMatch[2])
        const seconds = parseFloat(durationMatch[3])
        duration = hours * 3600 + minutes * 60 + seconds
      }

      // Extraer progreso actual
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
      if (timeMatch && duration > 0) {
        const hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2])
        const seconds = parseFloat(timeMatch[3])
        currentTime = hours * 3600 + minutes * 60 + seconds
        const progress = Math.min(Math.round((currentTime / duration) * 100), 100)

        if (onProgress) {
          onProgress(progress)
        }
      }
    })

    process.on('close', (code) => {
      if (code === 0) {
        console.log('Video convertido exitosamente a MP4 (H.264)')
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
  ipcMain.handle('media:import-file', async (event, sourcePath: string, folder?: string) => {
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

      // Determinar tipo
      let type: MediaType
      if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
        type = MediaType.IMAGE
      } else if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
        type = MediaType.VIDEO
      } else {
        throw new Error(`Formato no soportado: ${ext}`)
      }

      // Para videos, verificar compatibilidad
      let shouldConvert = false
      if (type === MediaType.VIDEO) {
        const { compatible, codec, profile } = await checkVideoCompatibility(sourcePath)

        if (!compatible) {
          console.log(`Video no compatible detectado: ${codec} ${profile}`)

          // Preguntar al usuario si desea convertir
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: 'Video no compatible',
            message: `El video que intentas importar tiene un codec (${codec} ${profile}) que puede no ser compatible con la reproducción en la aplicación.`,
            detail:
              '¿Deseas convertir el video a un formato compatible (MP4 H.264)? Esto puede tardar unos minutos dependiendo del tamaño del video.',
            buttons: ['Cancelar', 'Convertir'],
            defaultId: 1,
            cancelId: 0
          })

          if (result.response === 0) {
            // Usuario canceló
            throw new Error('Importación cancelada por el usuario')
          }

          shouldConvert = true
        }
      }

      // Convertir video si es necesario
      let finalExt = ext
      let finalSourcePath = sourcePath

      if (shouldConvert) {
        console.log('Convirtiendo video a MP4 (H.264)...')
        const tempConvertedPath = path.join(filesPath, `temp-${hash}.mp4`)

        await convertVideoToCompatibleFormat(sourcePath, tempConvertedPath, (progress) => {
          // Enviar progreso al frontend
          event.sender.send('media:import-progress', { progress, fileName: originalName })
        })

        finalSourcePath = tempConvertedPath
        finalExt = '.mp4'
        console.log('Conversión completada')
      }

      // Para videos, NO convertir automáticamente - usar original
      // El usuario puede convertir manualmente si hay problemas de compatibilidad
      const newFileName = `${originalName}-${hash}${finalExt}`
      const destPath = path.join(filesPath, newFileName)

      // Copiar o mover archivo
      if (finalSourcePath !== sourcePath) {
        // Si se convirtió, mover el archivo temporal
        fs.renameSync(finalSourcePath, destPath)
      } else {
        // Si no se convirtió, copiar el original
        fs.copyFileSync(sourcePath, destPath)
      }

      // Crear thumbnail optimizado y fallback para videos
      const thumbnailFileName = `thumb-${originalName.replaceAll(' ', '_')}-${hash}.jpg`
      const thumbnailPath = path.join(thumbnailsPath, thumbnailFileName)

      let fallbackFileName: string | undefined
      let fallbackPath: string | undefined

      if (type === MediaType.IMAGE) {
        await generateImageThumbnail(sourcePath, thumbnailPath)
      } else {
        // Para videos: generar thumbnail (segundo 1.5) y fallback (frame inicial)
        await generateVideoThumbnail(destPath, thumbnailPath)

        fallbackFileName = `fallback-${originalName.replaceAll(' ', '_')}-${hash}.jpg`
        fallbackPath = path.join(thumbnailsPath, fallbackFileName)
        await generateVideoFallback(destPath, fallbackPath)
      }

      const filePath = folder ? `files/${folder}/${newFileName}` : `files/${newFileName}`

      return {
        name: originalName,
        type,
        format: finalExt.slice(1),
        filePath,
        fileSize: stats.size,
        thumbnail: `thumbnails/${thumbnailFileName}`,
        fallback: fallbackFileName ? `thumbnails/${fallbackFileName}` : undefined,
        folder: folder ?? undefined
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

  // Convertir video a formato compatible bajo demanda
  ipcMain.handle('media:convert-video', async (event, filePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const fullPath = path.join(userDataPath, 'media', filePath)

      if (!fs.existsSync(fullPath)) {
        throw new Error('Archivo no encontrado')
      }

      // Crear nombre para archivo convertido
      const parsedPath = path.parse(filePath)
      const convertedFileName = `${parsedPath.name}-converted.mp4`
      const convertedFilePath = path.join(parsedPath.dir, convertedFileName)
      const convertedFullPath = path.join(userDataPath, 'media', convertedFilePath)

      console.log('Convirtiendo video a MP4 (H.264)...')

      await convertVideoToCompatibleFormat(fullPath, convertedFullPath, (progress) => {
        // Enviar progreso al frontend
        event.sender.send('media:convert-progress', {
          progress,
          filePath,
          convertedFilePath
        })
      })

      console.log('Conversión completada')

      return {
        originalPath: filePath,
        convertedPath: convertedFilePath,
        success: true
      }
    } catch (error: any) {
      console.error('Error al convertir video:', error)
      throw error
    }
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
  ipcMain.handle('media:rename', async (_event, oldPath: string, newName: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const basePath = path.join(userDataPath, 'media', 'files')
      const oldFullPath = path.join(basePath, oldPath)
      const directory = path.dirname(oldPath)

      // Preservar la extensión del archivo original si no se proporcionó
      const oldExt = path.extname(oldPath)
      const newExt = path.extname(newName)
      const finalNewName = newExt ? newName : newName + oldExt

      const newPath = directory === '.' ? finalNewName : path.join(directory, finalNewName)
      const newFullPath = path.join(basePath, newPath)

      if (!fs.existsSync(oldFullPath)) {
        throw new Error(
          `El archivo "${oldPath}" no existe en la ubicación esperada: ${oldFullPath}`
        )
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
  })

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

  // Mover archivo o carpeta a otra ubicación
  ipcMain.handle('media:move', async (_event, sourcePath: string, targetFolder: string | null) => {
    try {
      const userDataPath = app.getPath('userData')
      const basePath = path.join(userDataPath, 'media', 'files')
      const sourceFullPath = path.join(basePath, sourcePath)
      const fileName = path.basename(sourcePath)
      const targetPath = targetFolder ? path.join(targetFolder, fileName) : fileName
      const targetFullPath = path.join(basePath, targetPath)

      if (!fs.existsSync(sourceFullPath)) {
        throw new Error(
          `El archivo "${sourcePath}" no existe en la ubicación esperada: ${sourceFullPath}`
        )
      }

      if (fs.existsSync(targetFullPath)) {
        throw new Error('Ya existe un archivo o carpeta con ese nombre en el destino')
      }

      // Crear directorio destino si no existe
      const targetDir = path.dirname(targetFullPath)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      fs.renameSync(sourceFullPath, targetFullPath)

      return { success: true, newPath: targetPath }
    } catch (error: any) {
      console.error('Error al mover:', error)
      throw error
    }
  })

  // Copiar archivo o carpeta
  ipcMain.handle(
    'media:copy-file',
    async (_event, sourcePath: string, targetFolder: string | null, isFolder: boolean) => {
      try {
        const userDataPath = app.getPath('userData')
        const basePath = path.join(userDataPath, 'media', 'files')
        const sourceFullPath = path.join(basePath, sourcePath)

        if (!fs.existsSync(sourceFullPath)) {
          throw new Error(`El archivo o carpeta "${sourcePath}" no existe`)
        }

        // Obtener el nombre base y extensión
        const fileName = path.basename(sourcePath)
        const ext = path.extname(fileName)
        const baseName = path.basename(fileName, ext)

        // Generar nombre único para la copia
        const hash = crypto.randomBytes(4).toString('hex')
        const newFileName = ext ? `${baseName}-copia-${hash}${ext}` : `${baseName}-copia-${hash}`

        const targetPath = targetFolder ? path.join(targetFolder, newFileName) : newFileName
        const targetFullPath = path.join(basePath, targetPath)

        // Crear directorio destino si no existe
        const targetDir = path.dirname(targetFullPath)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }

        if (isFolder) {
          // Copiar carpeta recursivamente
          copyFolderRecursive(sourceFullPath, targetFullPath)
          return { success: true, newPath: targetPath, newFileName }
        } else {
          // Copiar archivo
          fs.copyFileSync(sourceFullPath, targetFullPath)

          // Copiar thumbnail si existe
          const thumbnailsPath = path.join(userDataPath, 'media', 'thumbnails')
          let newThumbnailPath: string | undefined

          // Buscar thumbnail asociado (podría tener diferentes nombres)
          if (fs.existsSync(thumbnailsPath)) {
            const thumbnailFiles = fs.readdirSync(thumbnailsPath)
            const sourceBaseName = path.basename(sourcePath, ext)

            for (const thumbFile of thumbnailFiles) {
              if (thumbFile.includes(sourceBaseName)) {
                const sourceThumbPath = path.join(thumbnailsPath, thumbFile)
                const newThumbName = `thumb-${baseName.replaceAll(' ', '_')}-copia-${hash}.jpg`
                const targetThumbPath = path.join(thumbnailsPath, newThumbName)
                fs.copyFileSync(sourceThumbPath, targetThumbPath)
                newThumbnailPath = `thumbnails/${newThumbName}`
                break
              }
            }
          }

          return { success: true, newPath: targetPath, newFileName, newThumbnail: newThumbnailPath }
        }
      } catch (error: any) {
        console.error('Error al copiar:', error)
        throw error
      }
    }
  )
}

// Función auxiliar para copiar carpetas recursivamente
function copyFolderRecursive(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }

  const files = fs.readdirSync(source)

  for (const file of files) {
    const sourcePath = path.join(source, file)
    const targetPath = path.join(target, file)

    if (fs.statSync(sourcePath).isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}
