import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerRoutes } from '../../database'
import { initPrisma } from './prisma'
import {
  createMainWindow,
  createSongWindow,
  createTagsSongWindow,
  createThemeWindow
} from './windowManager'
import { registerMediaHandlers } from './mediaHandlers'
import { startMediaServer, stopMediaServer, getMediaServerPort } from './mediaServer'
import { initializeDefaultBibles } from './bibleManager'
import { initializeBibleSchema } from './bibleInitializer'

import 'reflect-metadata'
import { authStore } from '../../database/stores/authStore'
import fontList from 'font-list'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await initPrisma()

  // Inicializar biblias por defecto
  initializeDefaultBibles()
  await initializeBibleSchema()

  // Inicia
  // Iniciar servidor de medios
  startMediaServer()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Registrar handlers de medios
  registerMediaHandlers()
  registerRoutes()
  // Obtener puerto del servidor de medios
  ipcMain.handle('get-media-server-port', () => {
    return getMediaServerPort()
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

  // Abrir ventana para crear/editar tema
  ipcMain.on('open-tag-songs-window', () => {
    createTagsSongWindow()
  })
  // Cerrar ventana actual
  ipcMain.on('close-current-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.close()
    }
  })

  // Notificar a ventana principal cuando se guarda un tema
  ipcMain.on('theme-saved', () => {
    const mainWindow = BrowserWindow.getAllWindows()
    if (mainWindow && mainWindow.length > 0) {
      mainWindow.forEach((win) => {
        win.webContents.send('theme-saved')
      })
    }
  })

  // Notificar a ventana principal cuando se guarda un tag
  ipcMain.on('tags-saved', () => {
    const mainWindow = BrowserWindow.getAllWindows()
    if (mainWindow && mainWindow.length > 0) {
      mainWindow.forEach((win) => {
        win.webContents.send('tags-saved')
      })
    }
  })

  // Notificar a ventana principal cuando se guarda una canción
  ipcMain.on('song-saved', () => {
    const mainWindow = BrowserWindow.getAllWindows()
    if (mainWindow && mainWindow.length > 0) {
      mainWindow.forEach((win) => {
        win.webContents.send('song-saved')
      })
    }
  })

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
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopMediaServer()
  app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
