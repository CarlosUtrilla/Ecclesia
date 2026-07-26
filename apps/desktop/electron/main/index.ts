import { initializeLiveMediaManager } from './liveMediaController/liveMediaController'
import { app, BrowserWindow, session, shell } from 'electron'
import { onIpc, onIpcFromWindow } from './ipcHelpers'
import path, { join } from 'path'
import fs from 'fs'
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

declare const __GOOGLE_CLIENT_ID__: string
declare const __GOOGLE_CLIENT_SECRET__: string

// Inyectar credenciales de build-time en process.env para que la API las encuentre
if (typeof __GOOGLE_CLIENT_ID__ !== 'undefined' && __GOOGLE_CLIENT_ID__) {
  process.env.GOOGLE_DRIVE_CLIENT_ID = __GOOGLE_CLIENT_ID__
}
if (typeof __GOOGLE_CLIENT_SECRET__ !== 'undefined' && __GOOGLE_CLIENT_SECRET__) {
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = __GOOGLE_CLIENT_SECRET__
}
import { showOAuthWindow } from './syncInit'

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
process.on('uncaughtException', (err) => {
  try {
    require('fs').appendFileSync(
      require('path').join(app.getPath('userData'), 'ecclesia-crash.log'),
      `[${new Date().toISOString()}] UNCAUGHT_EXCEPTION_MAIN:\n${err.stack ?? err.message}\n`
    )
  } catch { /* ignore */ }
})
process.on('unhandledRejection', (reason) => {
  try {
    const err = reason as { stack?: string; message?: string }
    require('fs').appendFileSync(
      require('path').join(app.getPath('userData'), 'ecclesia-crash.log'),
      `[${new Date().toISOString()}] UNHANDLED_REJECTION_MAIN:\n${err?.stack ?? err?.message ?? String(reason)}\n`
    )
  } catch { /* ignore */ }
})

app.whenReady().then(async () => {
  // Set up crash logger immediately
  setCrashLogPath(require('path').join(app.getPath('userData'), 'ecclesia-crash.log'))

  // --debug flag: disable GPU, log GPU info to crash log
  if (process.argv.includes('--debug')) {
    app.disableHardwareAcceleration()
    try {
      const logPath = require('path').join(app.getPath('userData'), 'ecclesia-crash.log')
      const gpuInfo = app.getGPUFeatureStatus()
      require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] GPU_INFO:\n${JSON.stringify(gpuInfo, null, 2)}\n`)
    } catch { /* ignore */ }
  }
  // V8 bytecode cache: tras la primera apertura, V8 guarda el bytecode compilado
  // en disco y las aperturas siguientes omiten parse+compile completamente.
  // Debe configurarse antes de crear cualquier BrowserWindow.
  session.defaultSession.setCodeCachePath(join(app.getPath('userData'), 'v8-code-cache'))

  const splash = createSplashWindow()
  await new Promise<void>((resolve) => splash.webContents.once('dom-ready', resolve))

  const crashLog = () => {
    try {
      const p = require('path').join(app.getPath('userData'), 'ecclesia-crash.log')
      require('fs').appendFileSync(p, `[${new Date().toISOString()}] STEP: ${new Error().stack?.split('\n')[2]?.trim() ?? ''}\n`)
    } catch { /* ignore */ }
  }

  crashLog()
  updateSplashStatus('Cargando entorno...')
  loadAppEnv(app.getPath('userData'))

  crashLog()
  updateSplashStatus('Inicializando base de datos...')
  setGetBiblesResourcesPath(getBiblesResourcesPath)
  const isDev = !app.isPackaged
  const config = {
    isDev,
    userDataPath: app.getPath('userData'),
    resourcesPath: process.resourcesPath || path.join(app.getAppPath(), '..'),
    cwd: process.cwd()
  }
  await initializeHttpServer(config, undefined)

  crashLog()
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ecclesia.app')
  app.setName('Ecclesia')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  crashLog()
  updateSplashStatus('Cargando medios...')
  initializeMediaManager()

  crashLog()
  //inicalizar gestor de pantallas
  initializeDisplayManager()
  // Inicializar manager de media en vivo
  initializeLiveMediaManager()

  crashLog()
  // Inicializar manager de actualizaciones automáticas
  initializeUpdaterManager()

  crashLog()
  // Inicializar manager de control remoto LAN
  initializeRemoteManager()

  crashLog()
  // Inicializar manager de busqueda de biblia
  initializeBibleSearchManager()

  onIpc('open-song-window', (songId?: number) => createSongWindow(songId))
  onIpc('open-theme-window', (themeId?: number) => createThemeWindow(themeId))
  onIpc('open-presentation-window', (presentationId?: number) =>
    createPresentationWindow(presentationId)
  )
  onIpc('open-tag-songs-window', () => createTagsSongWindow())
  onIpc('open-settings-window', (section?: string) => createSettingsWindow(section))
  onIpc('open-stage-control-window', () => createStageControlWindow())
  onIpc('open-oauth-window', () => showOAuthWindow())

  onIpcFromWindow('close-current-window', (win) => win.close())

  onIpc('open-external', (url: string) => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  onIpc('window:trigger-close', () => {
    const win = getMainWindow()
    if (win) win.close()
  })

  onIpc('media:import-pptx-file', async () => {
    const { dialog } = require('electron') as typeof import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Presentaciones PPTX', extensions: ['pptx'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const pptxPath = result.filePaths[0]
    const { importPptxToPresentation } = await import(
      '@ecclesia/api/src/pptxConverter'
    )
    const pptxResult = await importPptxToPresentation(pptxPath)

    const { getPrisma } = await import('@ecclesia/api/src/prisma')
    const prisma = getPrisma()

    const pptxMedia = await prisma.media.create({
      data: {
        name: pptxResult.originalName,
        type: 'PPTX',
        format: 'pptx',
        filePath: `presentation://${pptxResult.presentationId}`,
        fileSize: fs.statSync(pptxPath).size,
        folder: undefined,
        presentationId: pptxResult.presentationId,
        thumbnail: pptxResult.slideMediaRecords[0]?.thumbnail ?? null,
      },
    })

    return pptxMedia
  })

  onIpcFromWindow('theme-close-confirm', (win) => {
    if (!win.isDestroyed()) win.destroy()
  })

  onIpcFromWindow('presentation-close-confirm', (win) => {
    if (!win.isDestroyed()) win.destroy()
  })

  crashLog()
  updateSplashStatus('Abriendo Ecclesia...')
  const mainWindow = createMainWindow()

  mainWindow.webContents.on('crashed', (_, killed) => {
    try {
      require('fs').appendFileSync(
        require('path').join(app.getPath('userData'), 'ecclesia-crash.log'),
        `[${new Date().toISOString()}] RENDERER_CRASHED killed=${killed}\n`
      )
    } catch { /* ignore */ }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    crashLog()
    try {
      require('fs').appendFileSync(
        require('path').join(app.getPath('userData'), 'ecclesia-crash.log'),
        `[${new Date().toISOString()}] RENDERER_FINISHED_LOAD url=${mainWindow.webContents.getURL()}\n`
      )
    } catch { /* ignore */ }
  })

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
}).catch((err) => {
  try {
    require('fs').appendFileSync(
      require('path').join(app.getPath('userData'), 'ecclesia-crash.log'),
      `[${new Date().toISOString()}] FATAL_INIT_CRASH:\n${err?.stack ?? err?.message ?? String(err)}\n`
    )
  } catch { /* ignore */ }
  console.error('FATAL INIT ERROR:', err)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Don't quit immediately on Windows — keep process alive for diagnostics
  if (process.platform === 'darwin') return
  setTimeout(() => app.quit(), 500)
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
