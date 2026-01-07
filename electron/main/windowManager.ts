import { BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

export function createMainWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize() // Maximizar la ventana al mostrarla
    mainWindow.show()
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

  return mainWindow
}

export function createSongWindow(songId?: number): BrowserWindow {
  const songWindow = new BrowserWindow({
    width: 1100,
    height: 670,
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

  const route = songId ? `/song/${songId}` : '/song/new'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    songWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    songWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

  return songWindow
}

export function createThemeWindow(themeId?: number): BrowserWindow {
  const themeWindow = new BrowserWindow({
    width: 1100,
    height: 670,
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

  const route = themeId ? `/theme/${themeId}` : '/theme/new'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    themeWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
  } else {
    themeWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: route
    })
  }

  return themeWindow
}
