import { initializeLiveMediaManager } from './liveMediaController/liveMediaController'
import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerRoutes } from '../../database'
import { getPrisma, initPrisma } from './prisma'
import {
  createMainWindow,
  createPresentationWindow,
  createSettingsWindow,
  createSongWindow,
  createStageControlWindow,
  createStageLayoutWindow,
  createTagsSongWindow,
  createThemeWindow
} from './windowManager'
import 'reflect-metadata'
import fontList from 'font-list'
import { initializeBibleManager } from './bibleManager'
import { initializeMediaManager } from './mediaManager'
import { stopMediaServer } from './mediaManager/mediaServer'
import { initializeDisplayManager } from './displayManager'
import { initializeFontManager } from './fontManager'
import {
  applyPendingDriveRestoreOnStartup,
  initializeGoogleDriveSyncManager
} from './googleDriveSyncManager/googleDriveSyncManager'
import { loadAppEnv } from './loadEnv'

let isQuittingAfterStageTimersCleanup = false

async function clearPersistedStageTimersOnShutdown() {
  try {
    const prisma = getPrisma()
    const configs = await prisma.stageScreenConfig.findMany({
      select: {
        id: true,
        state: true
      }
    })

    const updates = configs.flatMap((config) => {
      try {
        const parsedState = JSON.parse(config.state) as {
          message?: string | null
          timers?: unknown[]
          clock?: {
            hourFormat?: '12' | '24'
            showMeridiem?: boolean
          }
        }

        if (!Array.isArray(parsedState.timers) || parsedState.timers.length === 0) {
          return []
        }

        return [
          prisma.stageScreenConfig.update({
            where: { id: config.id },
            data: {
              state: JSON.stringify({
                ...parsedState,
                timers: []
              })
            }
          })
        ]
      } catch {
        return []
      }
    })

    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }
  } catch (error) {
    console.error('Error al limpiar timers stage al cerrar la aplicación:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  loadAppEnv()
  await applyPendingDriveRestoreOnStartup()
  await initPrisma()

  // Inicia

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ecclesia.app')

  app.setName('Ecclesia')
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Inicializar gestor de medios
  initializeMediaManager()
  // Inicializar gestor de fuentes
  initializeFontManager()
  // Registrar rutas de la base de datos
  registerRoutes()
  // Inicializar gestor de biblias
  initializeBibleManager()
  //inicalizar gestor de pantallas
  initializeDisplayManager()
  // Inicializar manager de media en vivo
  initializeLiveMediaManager()
  // Inicializar manager de sincronización con Google Drive
  initializeGoogleDriveSyncManager()

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

  // Abrir ventana para crear/editar canción
  ipcMain.on('open-song-window', (_event, songId?: number) => {
    createSongWindow(songId)
  })

  // Abrir ventana para crear/editar tema
  ipcMain.on('open-theme-window', (_event, themeId?: number) => {
    createThemeWindow(themeId)
  })

  ipcMain.on('open-presentation-window', (_event, presentationId?: number) => {
    createPresentationWindow(presentationId)
  })

  // Abrir ventana para crear/editar tema
  ipcMain.on('open-tag-songs-window', () => {
    createTagsSongWindow()
  })

  // Abrir ventana de ajustes
  ipcMain.on('open-settings-window', () => {
    createSettingsWindow()
  })

  ipcMain.on('open-stage-control-window', () => {
    createStageControlWindow()
  })

  ipcMain.on('open-stage-layout-window', () => {
    createStageLayoutWindow()
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

  ipcMain.on('presentation-saved', () => {
    const mainWindow = BrowserWindow.getAllWindows()
    if (mainWindow && mainWindow.length > 0) {
      mainWindow.forEach((win) => {
        win.webContents.send('presentation-saved')
      })
    }
  })

  createMainWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopMediaServer()
  app.quit()
})

app.on('before-quit', (event) => {
  if (isQuittingAfterStageTimersCleanup) {
    return
  }

  event.preventDefault()
  void clearPersistedStageTimersOnShutdown().finally(() => {
    isQuittingAfterStageTimersCleanup = true
    app.quit()
  })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
