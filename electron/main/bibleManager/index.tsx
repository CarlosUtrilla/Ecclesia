import { dialog, ipcMain } from 'electron'
import {
  deleteBible,
  importBibles,
  initializeDefaultBibles,
  listAvailableBibles
} from './bibleManager'
import { initializeBibleSchema } from './bibleInitializer'

export async function initializeBibleManager() {
  // Inicializar biblias por defecto
  initializeDefaultBibles()
  await initializeBibleSchema()
  // Registrar handlers de biblias
  ipcMain.handle('bible:import-files', async (_event, sourcePaths: string | string[]) => {
    try {
      const results = importBibles(sourcePaths)
      return Array.isArray(sourcePaths) ? results : results[0]
    } catch (error: any) {
      console.error('Error al importar biblias:', error)
      throw error
    }
  })

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

    return result.filePaths
  })

  ipcMain.handle('bible:list-available', async () => {
    try {
      return listAvailableBibles()
    } catch (error: any) {
      console.error('Error al listar biblias:', error)
      throw error
    }
  })

  ipcMain.handle('bible:delete', async (_event, filename: string) => {
    try {
      deleteBible(filename)
      return { success: true }
    } catch (error: any) {
      console.error('Error al eliminar biblia:', error)
      throw error
    }
  })
}
