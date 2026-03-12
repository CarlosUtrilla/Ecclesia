import { BrowserWindow, shell, dialog, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let splashWindowRef: BrowserWindow | null = null
let settingsWindowRef: BrowserWindow | null = null
let stageControlWindowRef: BrowserWindow | null = null
let stageLayoutWindowRef: BrowserWindow | null = null

function loadRoute(win: BrowserWindow, route: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Confirmar antes de cerrar la aplicación
  mainWindow.on('close', (event) => {
    event.preventDefault() // Prevenir el cierre inmediato

    dialog
      .showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancelar', 'Cerrar'],
        defaultId: 0,
        cancelId: 0,
        title: 'Confirmar cierre',
        message: '¿Estás seguro de que quieres cerrar la aplicación?',
        detail: 'Todas las ventanas abiertas se cerrarán.'
      })
      .then(({ response }) => {
        if (response === 1) {
          // Usuario confirmó el cierre
          // Cerrar todas las ventanas
          const allWindows = BrowserWindow.getAllWindows()
          allWindows.forEach((win) => {
            win.destroy() // Usar destroy() para evitar el evento 'close' recursivo
          })
        }
        // Si response === 0, no hacer nada (cancelar)
      })
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
  const route = songId ? `/song/${songId}` : '/song/new'

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const songWindow = new BrowserWindow({
    title: 'Editor de canciones',
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  loadRoute(songWindow, route)
  return songWindow
}

export function createThemeWindow(themeId?: number): BrowserWindow {
  const route = themeId ? `/theme/${themeId}` : '/theme/new'

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const themeWindow = new BrowserWindow({
    width: Math.round(width * 0.95),
    height: Math.round(height * 0.95),
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  loadRoute(themeWindow, route)
  return themeWindow
}

export function createPresentationWindow(presentationId?: number): BrowserWindow {
  const route = presentationId ? `/presentation/${presentationId}` : '/presentation/new'

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const presentationWindow = new BrowserWindow({
    title: 'Editor de presentaciones',
    width: Math.round(width * 0.85),
    height: Math.round(height * 0.85),
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  loadRoute(presentationWindow, route)
  return presentationWindow
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

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindowRef && !settingsWindowRef.isDestroyed()) {
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

  loadRoute(settingsWindow, '/settings')
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

export function createStageLayoutWindow(): BrowserWindow {
  if (stageLayoutWindowRef && !stageLayoutWindowRef.isDestroyed()) {
    return focusExistingWindow(stageLayoutWindowRef)
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const stageLayoutWindow = new BrowserWindow({
    title: 'Layout de Escenario',
    width: Math.round(width * 0.75),
    height: Math.round(height * 0.85),
    minWidth: 1000,
    minHeight: 700,
    show: true,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  stageLayoutWindow.on('closed', () => {
    stageLayoutWindowRef = null
  })

  loadRoute(stageLayoutWindow, '/stage-layout')
  stageLayoutWindowRef = stageLayoutWindow
  return stageLayoutWindow
}
