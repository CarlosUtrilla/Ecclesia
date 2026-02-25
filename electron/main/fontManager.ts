import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import FontsController from '../../database/controllers/fonts/fonts.controller'

import { app } from 'electron'
const getFontsDir = () => {
  const userData = app.getPath('userData')
  return path.join(userData, 'media', 'fonts')
}

export function initializeFontManager() {
  ipcMain.handle('fonts.uploadFont', async (_event, { name, fileName, fileBuffer }) => {
    try {
      const FONTS_DIR = getFontsDir()
      if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true })
      const filePath = path.join(FONTS_DIR, fileName)
      fs.writeFileSync(filePath, Buffer.from(fileBuffer))
      const controller = new FontsController()
      await controller.addFont({ name, fileName, filePath: 'fonts/' + fileName })

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('font-added')
      })
      return { success: true, filePath: 'fonts/' + fileName }
    } catch (error) {
      let message = 'Unknown error'
      if (
        typeof error === 'object' &&
        error &&
        'message' in error &&
        typeof (error as any).message === 'string'
      ) {
        message = (error as any).message
      }
      return { success: false, error: message }
    }
  })

  ipcMain.handle('fonts.deleteFontFile', async (_event, { fileName }) => {
    try {
      const FONTS_DIR = getFontsDir()
      const filePath = path.join(FONTS_DIR, fileName)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return { success: true }
    } catch (error) {
      let message = 'Unknown error'
      if (
        typeof error === 'object' &&
        error &&
        'message' in error &&
        typeof (error as any).message === 'string'
      ) {
        message = (error as any).message
      }
      return { success: false, error: message }
    }
  })
}
