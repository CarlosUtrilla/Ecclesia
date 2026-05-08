import { ipcMain, dialog, app } from 'electron'
import path from 'path'
import { MediaType } from '@ecclesia/api'
import {
  cleanupTempPath,
  copyMediaSource,
  createMediaFolder,
  deleteMediaFolder,
  extractZipMp4,
  importClipboardImage,
  importMediaFromSourcePath,
  listMediaFolders,
  moveMediaPath,
  renameMediaPath
} from '@ecclesia/api/src/controllers/media/media.storage'

export function registerMediaHandlers() {
  // Abrir diálogo para seleccionar archivos
  ipcMain.handle('media:select-files', async (_event, type: MediaType | 'all') => {
    const filters: any[] = []

    if (type === 'all') {
      filters.push({
        name: 'Medios',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'avi', 'zip']
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
      return await importMediaFromSourcePath(sourcePath, folder)
    } catch (error: any) {
      console.error('Error al importar archivo:', error)
      throw error
    }
  })

  ipcMain.handle(
    'media:import-clipboard-image',
    async (_event, bytes: number[], mimeType: string, folder?: string) => {
      try {
        return await importClipboardImage(bytes, mimeType, folder)
      } catch (error: any) {
        console.error('Error al importar imagen desde portapapeles:', error)
        throw error
      }
    }
  )

  // Obtener ruta completa de un archivo de media
  ipcMain.handle('media:get-full-path', (_event, fileName: string) => {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'media', fileName)
  })

  ipcMain.handle('get-media-server-port', () => {
    return 7777
  })

  // Eliminar archivo físico
  ipcMain.handle(
    'media:delete-file',
    async (_event, filePath: string, thumbnail?: string | null) => {
      try {
        //return deleteMedia(filePath, thumbnail)
      } catch (error: any) {
        console.error('Error al eliminar archivo:', error)
        throw error
      }
    }
  )

  // Crear carpeta
  ipcMain.handle('media:create-folder', async (_event, folderPath: string) => {
    try {
      return createMediaFolder(folderPath)
    } catch (error: any) {
      console.error('Error al crear carpeta:', error)
      throw error
    }
  })

  // Eliminar carpeta
  ipcMain.handle('media:delete-folder', async (_event, folderPath: string) => {
    try {
      return deleteMediaFolder(folderPath)
    } catch (error: any) {
      console.error('Error al eliminar carpeta:', error)
      throw error
    }
  })

  // Renombrar archivo o carpeta
  ipcMain.handle('media:rename', async (_event, oldPath: string, newName: string) => {
    try {
      return renameMediaPath(oldPath, newName)
    } catch (error: any) {
      console.error('Error al renombrar:', error)
      throw error
    }
  })

  // Listar carpetas
  ipcMain.handle('media:list-folders', async (_event, parentFolder?: string) => {
    try {
      return listMediaFolders(parentFolder)
    } catch (error: any) {
      console.error('Error al listar carpetas:', error)
      throw error
    }
  })

  // Mover archivo o carpeta a otra ubicación
  ipcMain.handle('media:move', async (_event, sourcePath: string, targetFolder: string | null) => {
    try {
      return moveMediaPath(sourcePath, targetFolder)
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
        return copyMediaSource(sourcePath, targetFolder, isFolder)
      } catch (error: any) {
        console.error('Error al copiar:', error)
        throw error
      }
    }
  )

  ipcMain.handle('media:extract-zip-mp4', async (_event, zipPath: string) => {
    try {
      return extractZipMp4(zipPath)
    } catch (error: any) {
      console.error('Error al extraer ZIP de Canva:', error)
      throw error
    }
  })

  ipcMain.handle('media:cleanup-temp-path', async (_event, targetPath: string) => {
    try {
      return cleanupTempPath(targetPath)
    } catch (error: any) {
      console.error('Error al limpiar temporales de Canva import:', error)
      throw error
    }
  })
}
