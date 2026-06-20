import { ipcMain, dialog, app } from 'electron'
import path from 'path'
import * as fs from 'fs'
import { MediaType } from '@ecclesia/api'

export function registerMediaHandlers() {
  // Diálogo para seleccionar archivos multimedia y retornar su contenido
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
      defaultPath: app.getPath('pictures'),
      properties: ['openFile', 'multiSelections'],
      filters
    })

    if (result.canceled) {
      return []
    }

    const files = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const buffer = await fs.promises.readFile(filePath)
        return {
          fileName: path.basename(filePath),
          bytes: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
          fileSize: buffer.length
        }
      })
    )

    return files
  })

  // Diálogo para seleccionar archivos .ebbl (Biblia)
  ipcMain.handle('bible:select-bible-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Archivos de Biblia',
          extensions: ['ebbl']
        }
      ]
    })

    if (result.canceled) {
      return []
    }

    const files = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const buffer = await fs.promises.readFile(filePath)
        return {
          fileName: path.basename(filePath),
          bytes: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
          fileSize: buffer.length
        }
      })
    )

    return files
  })
}
