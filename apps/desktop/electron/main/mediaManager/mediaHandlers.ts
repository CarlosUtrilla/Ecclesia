import { ipcMain, dialog, app } from 'electron'
import path from 'path'
import * as fs from 'fs'
import { MediaType } from '@ecclesia/api'

export function registerMediaHandlers() {
  // Diálogo para seleccionar carpeta de destino
  ipcMain.handle('media:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Guardar archivo en directorio específico
  ipcMain.handle(
    'media:write-file-to-dir',
    async (_event, { dir, fileName, content }: { dir: string; fileName: string; content: string }) => {
      const filePath = path.join(dir, fileName)
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return filePath
    }
  )

  // Copiar archivo existente a directorio específico
  ipcMain.handle(
    'media:copy-file-to-dir',
    async (_event, { sourcePath, dir, fileName }: { sourcePath: string; dir: string; fileName: string }) => {
      const destPath = path.join(dir, fileName)
      await fs.promises.copyFile(sourcePath, destPath)
      return destPath
    }
  )

  // Diálogo para seleccionar archivos multimedia y retornar su contenido
  ipcMain.handle('media:select-files', async (_event, type: MediaType | 'all') => {
    const filters: any[] = []

    if (type === 'all') {
      filters.push({
        name: 'Medios',
        extensions: ['png', "pdf", 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'avi', 'zip']
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

  ipcMain.handle('get-media-server-port', () => {
    return 7777
  })

  // Diálogo para guardar archivo (export)
  ipcMain.handle(
    'media:save-file',
    async (
      _event,
      { content, defaultName, sourcePath }: { content?: string; defaultName: string; sourcePath?: string }
    ) => {
      const ext = sourcePath
        ? path.extname(sourcePath).slice(1)
        : defaultName.split('.').pop() || 'json'

      const result = await dialog.showSaveDialog({
        defaultPath: path.join(app.getPath('downloads'), defaultName),
        filters: [
          { name: ext.toUpperCase(), extensions: [ext] },
          { name: 'Todos', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      if (sourcePath) {
        await fs.promises.copyFile(sourcePath, result.filePath)
      } else if (content !== undefined) {
        await fs.promises.writeFile(result.filePath, content, 'utf-8')
      }

      return result.filePath
    }
  )

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
