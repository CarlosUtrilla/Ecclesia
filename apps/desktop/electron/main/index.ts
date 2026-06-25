import { initializeLiveMediaManager } from './liveMediaController/liveMediaController'
import { app, BrowserWindow, ipcMain, session } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initializeHttpServer } from '@ecclesia/api'
import { setCrashLogPath } from '@ecclesia/api/src/utils/crashLogger'
import { loadAppEnv } from '@ecclesia/api/src/utils/loadEnv'
import { getBiblesResourcesPath } from './paths'
import { setGetBiblesResourcesPath } from '@ecclesia/api/src/prisma'
import {
  createMainWindow,
  createPresentationWindow,
  createSettingsWindow,
  createSongWindow,
  createSplashWindow,
  closeSplashWindow,
  updateSplashStatus,
  createStageControlWindow,
  createTagsSongWindow,
  createThemeWindow,
  getMainWindow
} from './windowManager'
import 'reflect-metadata'
import { initializeMediaManager } from './mediaManager'
import { initializeDisplayManager } from './displayManager'

import { initializeUpdaterManager } from './updaterManager/updaterManager'
import { initializeBibleSearchManager } from './bibleSearchManager'
import { initializeRemoteManager } from './remoteManager'
import { showOAuthWindow } from './sync/sync-init'

let isQuittingAfterStageTimersCleanup = false

BigInt.prototype.toJSON = function () {
  const int = Number.parseInt(this.toString())
  return int ?? this.toString()
}

async function clearPersistedStageTimersOnShutdown() {
  //REPARAR ESTO
  /* try {
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
  }*/
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // V8 bytecode cache: tras la primera apertura, V8 guarda el bytecode compilado
  // en disco y las aperturas siguientes omiten parse+compile completamente.
  // Debe configurarse antes de crear cualquier BrowserWindow.
  session.defaultSession.setCodeCachePath(join(app.getPath('userData'), 'v8-code-cache'))

  const splash = createSplashWindow()
  await new Promise<void>((resolve) => splash.webContents.once('dom-ready', resolve))

  updateSplashStatus('Cargando entorno...')
  setCrashLogPath(path.join(app.getPath('userData'), 'ecclesia-crash.log'))
  loadAppEnv(app.getPath('userData'))

  updateSplashStatus('Inicializando base de datos...')
  setGetBiblesResourcesPath(getBiblesResourcesPath)
  const isDev = !app.isPackaged
  const config = {
    isDev,
    userDataPath: app.getPath('userData'),
    resourcesPath: process.resourcesPath || path.join(app.getAppPath(), '..'),
    cwd: process.cwd()
  }
  await initializeHttpServer(config, undefined, (keys) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('invalidate-queries', keys)
      }
    })
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ecclesia.app')
  app.setName('Ecclesia')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  updateSplashStatus('Cargando medios...')
  initializeMediaManager()

  //inicalizar gestor de pantallas
  initializeDisplayManager()
  // Inicializar manager de media en vivo
  initializeLiveMediaManager()

  // Inicializar manager de actualizaciones automáticas
  initializeUpdaterManager()

  // Inicializar manager de control remoto LAN
  initializeRemoteManager()

  // Inicializar manager de busqueda de biblia
  initializeBibleSearchManager()

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

  // Abrir ventana de autenticación OAuth de Google Drive
  ipcMain.on('open-oauth-window', () => {
    showOAuthWindow()
  })

  // Cerrar ventana actual
  ipcMain.on('close-current-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.close()
    }
  })

  // Disparar cierre de la ventana principal (para instalar actualizacion)
  ipcMain.on('window:trigger-close', () => {
    const win = getMainWindow()
    if (win) win.close()
  })

  // Confirmar cierre de ventana de tema (el renderer aprobó cerrar)
  ipcMain.on('theme-close-confirm', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
  })

  ipcMain.on('presentation-close-confirm', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
  })

  updateSplashStatus('Abriendo Ecclesia...')
  const mainWindow = createMainWindow()

  mainWindow.once('ready-to-show', () => {
    closeSplashWindow()
    mainWindow.maximize()
    mainWindow.show()
  })

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
