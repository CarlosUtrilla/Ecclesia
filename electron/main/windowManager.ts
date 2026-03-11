import { BrowserWindow, shell, dialog, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let splashWindowRef: BrowserWindow | null = null
let settingsWindowRef: BrowserWindow | null = null
let stageControlWindowRef: BrowserWindow | null = null
let stageLayoutWindowRef: BrowserWindow | null = null

// Pool de ventanas pre-calentadas para editores. Se crean ocultas en background
// tras la carga inicial, de modo que al abrirlas el proceso Chromium ya existe.
let warmSongWindowRef: BrowserWindow | null = null
let warmThemeWindowRef: BrowserWindow | null = null

function loadRoute(win: BrowserWindow, route: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

// Muestra una ventana ya pre-calentada, navegando a la ruta exacta si es necesario.
// Si la ventana todavía está cargando, espera a did-finish-load antes de navegar y mostrar.
function showWarmWindow(win: BrowserWindow, route: string): void {
  const navigate = () => {
    win.webContents
      .executeJavaScript(`window.location.hash = ${JSON.stringify('#' + route)}`)
      .catch(() => {})
      .finally(() => {
        // Dar un tick a React Router para procesar el cambio de hash antes de mostrar
        setTimeout(() => win.show(), 30)
      })
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', navigate)
  } else {
    navigate()
  }
}

export function prewarmEditorWindows(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  if (!warmSongWindowRef || warmSongWindowRef.isDestroyed()) {
    warmSongWindowRef = new BrowserWindow({
      title: 'Editor de canciones',
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.8),
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
    })
    loadRoute(warmSongWindowRef, '/song/new')
    warmSongWindowRef.on('closed', () => { warmSongWindowRef = null })
  }

  if (!warmThemeWindowRef || warmThemeWindowRef.isDestroyed()) {
    warmThemeWindowRef = new BrowserWindow({
      width: Math.round(width * 0.95),
      height: Math.round(height * 0.95),
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
    })
    loadRoute(warmThemeWindowRef, '/theme/new')
    warmThemeWindowRef.on('closed', () => { warmThemeWindowRef = null })
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

  if (warmSongWindowRef && !warmSongWindowRef.isDestroyed()) {
    const win = warmSongWindowRef
    warmSongWindowRef = null
    showWarmWindow(win, route)
    // Reponer el pool en background para la próxima apertura
    setTimeout(prewarmEditorWindows, 1500)
    return win
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const songWindow = new BrowserWindow({
    title: 'Editor de canciones',
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  songWindow.on('ready-to-show', () => {
    songWindow.show()
  })

  loadRoute(songWindow, route)
  return songWindow
}

export function createThemeWindow(themeId?: number): BrowserWindow {
  const route = themeId ? `/theme/${themeId}` : '/theme/new'

  if (warmThemeWindowRef && !warmThemeWindowRef.isDestroyed()) {
    const win = warmThemeWindowRef
    warmThemeWindowRef = null
    showWarmWindow(win, route)
    setTimeout(prewarmEditorWindows, 1500)
    return win
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const themeWindow = new BrowserWindow({
    width: Math.round(width * 0.95),
    height: Math.round(height * 0.95),
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  themeWindow.on('ready-to-show', () => {
    themeWindow.show()
  })

  loadRoute(themeWindow, route)
  return themeWindow
}

export function createPresentationWindow(presentationId?: number): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const presentationWindow = new BrowserWindow({
    title: 'Editor de presentaciones',
    width: Math.round(width * 0.85),
    height: Math.round(height * 0.85),
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  presentationWindow.on('ready-to-show', () => {
    presentationWindow.show()
  })

  const route = presentationId ? `/presentation/${presentationId}` : '/presentation/new'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    presentationWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    presentationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

  return presentationWindow
}

export function createTagsSongWindow(): BrowserWindow {
  const tagSongWindow = new BrowserWindow({
    width: 950,
    height: 400,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  tagSongWindow.on('ready-to-show', () => {
    tagSongWindow.show()
  })

  const route = '/tagSongEditor'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    tagSongWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    tagSongWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

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
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindowRef = null
  })

  const route = '/settings'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

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
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  stageControlWindow.on('ready-to-show', () => {
    stageControlWindow.show()
  })

  stageControlWindow.on('closed', () => {
    stageControlWindowRef = null
  })

  const route = '/stage-control'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    stageControlWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    stageControlWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

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
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  stageLayoutWindow.on('ready-to-show', () => {
    stageLayoutWindow.show()
  })

  stageLayoutWindow.on('closed', () => {
    stageLayoutWindowRef = null
  })

  const route = '/stage-layout'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    stageLayoutWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    stageLayoutWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

  stageLayoutWindowRef = stageLayoutWindow
  return stageLayoutWindow
}
