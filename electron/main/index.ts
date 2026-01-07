import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import path from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerRoutes } from '../../database'
import { initPrisma } from './prisma'
import { createMainWindow, createSongWindow, createThemeWindow } from './windowManager'

import 'reflect-metadata'
import { authStore } from '../../database/stores/authStore'
import fs from 'fs'
import fontList from 'font-list'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await initPrisma()
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Obtener fuentes del sistema
  ipcMain.handle('get-system-fonts', async () => {
    try {
      const fonts = await fontList.getFonts()
      return fonts
    } catch (error) {
      console.error('Error al obtener fuentes del sistema:', error)
      return []
    }
  })

  // Obtener todas las pantallas disponibles
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays()
    return displays.map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      aspectRatio: display.bounds.width / display.bounds.height
    }))
  })

  // Abrir ventana para crear/editar canción
  ipcMain.on('open-song-window', (_event, songId?: number) => {
    createSongWindow(songId)
  })

  // Abrir ventana para crear/editar tema
  ipcMain.on('open-theme-window', (_event, themeId?: number) => {
    createThemeWindow(themeId)
  })

  registerRoutes()
  createMainWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('web-contents-created', (_event, contents) => {
    // Capturar el frameId ANTES de que se destruya
    const frameId = (contents.mainFrame as any)?.frameId

    contents.on('destroyed', () => {
      if (frameId) {
        console.log(`🧹 Limpiando sesión para frameId ${frameId} desde main.ts`)
        authStore.clear(frameId)
      }
    })
  })

  //Protocolo seguro para cargar imagen en frontend
  protocol.handle('myapp', async (request) => {
    const userDataPath = app.getPath('userData')
    const imagesPath = path.join(userDataPath, 'images')
    const url = new URL(request.url)
    const fileName = url.pathname.slice(1) // quitar "/"
    const filePath = path.join(imagesPath, fileName)

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    const buffer = await fs.promises.readFile(filePath)
    const uint8 = new Uint8Array(buffer) // ← Convertir a Uint8Array

    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream'

    return new Response(uint8, { headers: { 'Content-Type': mime } })
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
