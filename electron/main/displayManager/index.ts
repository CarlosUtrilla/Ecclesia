import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function initializeDisplayManager() {
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
      aspectRatio: display.bounds.width / display.bounds.height,
      isMain: display.id === screen.getPrimaryDisplay().id
    }))
  })

  // listener para ver cuando se conecta o desconecta una pantalla
  screen.on('display-added', () => {
    console.log('Display added')
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      win.webContents.send('display-update')
    })
  })
  screen.on('display-removed', () => {
    console.log('Display removed')
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      win.webContents.send('display-update')
    })
  })

  // Abrir ventana en pantalla completa en la pantalla especificada
  ipcMain.handle('show-live-screen', (event, displayId: number) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) {
      throw new Error('No se pudo obtener la ventana principal')
    }
    const displays = screen.getAllDisplays()
    const targetDisplay = displays.find((display) => display.id === displayId)

    if (!targetDisplay) {
      throw new Error(`Display con ID ${displayId} no encontrado`)
    }

    const liveScreen = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      closable: false,
      minimizable: false,
      maximizable: false,
      fullscreen: true,
      simpleFullscreen: true, // macOS específico
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    // Mostrar la ventana después de cargar
    liveScreen.once('ready-to-show', () => {
      liveScreen.show()
      liveScreen.setAlwaysOnTop(true, 'screen-saver')
      liveScreen.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

      // macOS específico: Forzar fullscreen para ocultar menu bar
      if (process.platform === 'darwin') {
        liveScreen.setSimpleFullScreen(true)
        liveScreen.setMenuBarVisibility(false)
      }

      mainWindow.focus()
    })

    const route = '/live-screen'

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      liveScreen.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
    } else {
      liveScreen.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: route
      })
    }

    return liveScreen.id
  })

  // Cerrar ventana por su ID
  ipcMain.handle('close-live-screen', (event, windowId: number) => {
    const window = BrowserWindow.fromId(windowId)

    if (!window) {
      throw new Error(`Ventana con ID ${windowId} no encontrada`)
    }

    // Enfoque más agresivo para cerrar ventanas fullscreen
    try {
      // Salir del fullscreen y restaurar configuraciones antes de cerrar
      if (process.platform === 'darwin') {
        window.setSimpleFullScreen(false)
      }
      window.setFullScreen(false)
      window.setAlwaysOnTop(false)
      window.setClosable(true)

      // Usar destroy() como alternativa más directa
      window.destroy()
      return true
    } catch (error) {
      console.error('Error closing live screen:', error)
      // Si todo falla, forzar destrucción
      try {
        window.destroy()
        return true
      } catch (destroyError) {
        console.error('Error destroying live screen:', destroyError)
        return false
      }
    }
  })

  ipcMain.handle('show-new-display-connected', () => {
    const newDisplayWindow = new BrowserWindow({
      width: 600,
      height: 400,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      modal: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    // Mostrar la ventana después de cargar
    newDisplayWindow.once('ready-to-show', () => {
      newDisplayWindow.show()
      newDisplayWindow.focus()
    })

    const route = '/newDisplayConnected'

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      newDisplayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
    } else {
      newDisplayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: route
      })
    }
  })
}
