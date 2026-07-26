import { app, BrowserWindow, shell, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getIsSyncing, executeSyncCycle } from './syncInit'

let splashWindowRef: BrowserWindow | null = null
let settingsWindowRef: BrowserWindow | null = null
let stageControlWindowRef: BrowserWindow | null = null
let mainWindowRef: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : null
}

function loadRoute(win: BrowserWindow, route: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

type EditorWindowOptions = {
  prefix: string
  title?: string
  sizeFactor: number
  closeChannel?: string
}

function createEditorWindow(options: EditorWindowOptions, id?: number): BrowserWindow {
  const route = id ? `/${options.prefix}/${id}` : `/${options.prefix}/new`

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const editorWindow = new BrowserWindow({
    title: options.title,
    width: Math.round(width * options.sizeFactor),
    height: Math.round(height * options.sizeFactor),
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (options.closeChannel) {
    editorWindow.on('close', (event) => {
      if (editorWindow.webContents.isDestroyed()) return
      event.preventDefault()
      editorWindow.webContents.send(options.closeChannel!)
    })
  }

  loadRoute(editorWindow, route)
  return editorWindow
}

function focusExistingWindow(windowRef: BrowserWindow): BrowserWindow {
  if (windowRef.isMinimized()) {
    windowRef.restore()
  }
  windowRef.show()
  windowRef.focus()
  return windowRef
}

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      sandbox: true
    }
  })

  splashWindowRef = splash
  splash.on('closed', () => {
    splashWindowRef = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    splash.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/splash.html')
  } else {
    splash.loadFile(join(__dirname, '../renderer/splash.html'))
  }

  return splash
}

export function updateSplashStatus(message: string): void {
  if (!splashWindowRef || splashWindowRef.isDestroyed()) return
  splashWindowRef.webContents
    .executeJavaScript(
      `typeof window.updateStatus === 'function' && window.updateStatus(${JSON.stringify(message)})`
    )
    .catch(() => {})
}

export function closeSplashWindow(): void {
  if (splashWindowRef && !splashWindowRef.isDestroyed()) {
    splashWindowRef.destroy()
  }
  splashWindowRef = null
}

export function createMainWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'Ecclesia',
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // --debug flag: open DevTools + disable GPU on packaged build for diagnostics
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindowRef = mainWindow
  mainWindow.on('closed', () => {
    mainWindowRef = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Confirmar antes de cerrar la aplicación — dialog personalizado en el renderer
  let closeHandlerActive = false
  mainWindow.on('close', (event) => {
    event.preventDefault()
    if (closeHandlerActive) return
    closeHandlerActive = true

    mainWindow.webContents.send('app-close-requested')

    const closeApp = () => {
      app.exit()
    }

    let skipSyncInterval: ReturnType<typeof setInterval> | null = null

    const handleConfirm = () => {
      closeHandlerActive = false
      ipcMain.removeListener('app-close-cancel', handleCancel)
      executeSyncCycle('close')
        .catch(() => {})
        .finally(() => {
          const pollForSyncDone = () => {
            getIsSyncing()
              .then((syncing) => {
                if (syncing) {
                  skipSyncInterval = setInterval(() => {
                    getIsSyncing()
                      .then((stillSyncing) => {
                        if (!stillSyncing) {
                          if (skipSyncInterval) clearInterval(skipSyncInterval)
                          skipSyncInterval = null
                          ipcMain.removeListener('app-close-skip-sync', handleSkipSync)
                          closeApp()
                        }
                      })
                      .catch(() => {})
                  }, 300)
                } else {
                  ipcMain.removeListener('app-close-skip-sync', handleSkipSync)
                  closeApp()
                }
              })
              .catch(() => {
                closeApp()
              })
          }
          pollForSyncDone()
        })
    }

    const handleSkipSync = () => {
      if (skipSyncInterval) {
        clearInterval(skipSyncInterval)
        skipSyncInterval = null
      }
      closeHandlerActive = false
      ipcMain.removeListener('app-close-cancel', handleCancel)
      ipcMain.removeListener('app-close-confirm', handleConfirm)
      closeApp()
    }

    const handleCancel = () => {
      closeHandlerActive = false
      ipcMain.removeListener('app-close-confirm', handleConfirm)
      ipcMain.removeListener('app-close-skip-sync', handleSkipSync)
    }

    ipcMain.once('app-close-confirm', handleConfirm)
    ipcMain.once('app-close-cancel', handleCancel)
    ipcMain.once('app-close-skip-sync', handleSkipSync)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Loguear errores del renderer al log principal para diagnóstico en producción
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    const log = require('electron-log')
    log.error(`[renderer] did-fail-load: ${code} ${desc} ${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    const log = require('electron-log')
    log.error(`[renderer] process-gone: reason=${details.reason} exitCode=${details.exitCode}`)
  })
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 3) {
      // Sólo errores (level 3) se loguean siempre
      const log = require('electron-log')
      log.error(`[renderer] ${message} (${source}:${line})`)
    } else if (level === 2 && message) {
      // Warnings con mensaje no vacío
      const log = require('electron-log')
      log.warn(`[renderer] ${message} (${source}:${line})`)
    }
  })

  return mainWindow
}

export function createSongWindow(songId?: number): BrowserWindow {
  return createEditorWindow({ prefix: 'song', title: 'Editor de canciones', sizeFactor: 0.8 }, songId)
}

export function createThemeWindow(themeId?: number): BrowserWindow {
  return createEditorWindow({ prefix: 'theme', sizeFactor: 0.95, closeChannel: 'theme-close-requested' }, themeId)
}

export function createPresentationWindow(presentationId?: number): BrowserWindow {
  return createEditorWindow({ prefix: 'presentation', title: 'Editor de presentaciones', sizeFactor: 0.85, closeChannel: 'presentation-close-requested' }, presentationId)
}

export function createTagsSongWindow(): BrowserWindow {
  const tagSongWindow = new BrowserWindow({
    width: 950,
    height: 400,
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  loadRoute(tagSongWindow, '/tagSongEditor')
  return tagSongWindow
}

export function createSettingsWindow(section?: string): BrowserWindow {
  if (settingsWindowRef && !settingsWindowRef.isDestroyed()) {
    if (section) {
      settingsWindowRef.webContents.send('settings-navigate-section', section)
    }
    return focusExistingWindow(settingsWindowRef)
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const settingsWindow = new BrowserWindow({
    title: 'Ajustes',
    width: Math.round(width * 0.7),
    height: Math.round(height * 0.8),
    minWidth: 900,
    minHeight: 620,
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindowRef = null
  })

  loadRoute(settingsWindow, `/settings${section ? `?section=${section}` : ''}`)
  settingsWindowRef = settingsWindow
  return settingsWindow
}

export function createStageControlWindow(): BrowserWindow {
  if (stageControlWindowRef && !stageControlWindowRef.isDestroyed()) {
    return focusExistingWindow(stageControlWindowRef)
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const stageControlWindow = new BrowserWindow({
    title: 'Control de Escenario',
    width: Math.round(width * 0.6),
    height: Math.round(height * 0.75),
    minWidth: 900,
    minHeight: 620,
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  stageControlWindow.on('closed', () => {
    stageControlWindowRef = null
  })

  loadRoute(stageControlWindow, '/stage-control')
  stageControlWindowRef = stageControlWindow
  return stageControlWindow
}
