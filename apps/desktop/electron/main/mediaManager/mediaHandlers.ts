import { ipcMain, dialog } from 'electron'
import path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { MediaType } from '@ecclesia/api'
import {
  extractZipMp4,
} from '@ecclesia/api/src/controllers/media/media.storage'

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
          bytes: [...buffer],
          fileSize: buffer.length
        }
      })
    )

    return files
  })

  ipcMain.handle('get-media-server-port', () => {
    return 7777
  })

  // Extraer MP4s de un ZIP (flujo Canva)
  ipcMain.handle('media:extract-zip-mp4', async (_event, zipBytes: number[]) => {
    let tempZipPath: string | undefined
    let extractionTempDir: string | undefined
    try {
      const tempRoot = path.join(os.tmpdir(), 'ecclesia-canva-imports')
      if (!fs.existsSync(tempRoot)) fs.mkdirSync(tempRoot, { recursive: true })
      tempZipPath = path.join(tempRoot, `upload-${Date.now()}.zip`)
      fs.writeFileSync(tempZipPath, Buffer.from(zipBytes))
      const result = extractZipMp4(tempZipPath)
      extractionTempDir = result.tempDir
      const mp4Data = await Promise.all(
        result.mp4Paths.map(async (mp4Path) => {
          const buffer = await fs.promises.readFile(mp4Path)
          return { fileName: path.basename(mp4Path), bytes: [...buffer], fileSize: buffer.length }
        })
      )
      return mp4Data
    } catch (error: any) {
      console.error('Error al extraer ZIP de Canva:', error)
      throw error
    } finally {
      if (tempZipPath && fs.existsSync(tempZipPath)) {
        try { fs.unlinkSync(tempZipPath) } catch { /* ignorar */ }
      }
      if (extractionTempDir && fs.existsSync(extractionTempDir)) {
        try { fs.rmSync(extractionTempDir, { recursive: true, force: true }) } catch { /* ignorar */ }
      }
    }
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
          bytes: [...buffer],
          fileSize: buffer.length
        }
      })
    )

    return files
  })
}
