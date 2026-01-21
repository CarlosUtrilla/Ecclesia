import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { ThemeWithMedia } from '../../../database/controllers/themes/themes.dto'

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
      liveScreen.focus()
      liveScreen.setAlwaysOnTop(true, 'screen-saver')

      // macOS específico: Solo aplicar a la ventana de live screen
      if (process.platform === 'darwin') {
        liveScreen.setSimpleFullScreen(true)
        // Solo ocultar menu bar en la ventana de live screen, no globalmente
        liveScreen.setAutoHideMenuBar(true)
      }

      // Devolver el foco a la ventana principal después de un delay
      setTimeout(() => {
        mainWindow.focus()
        mainWindow.show()
      }, 250)
    })

    // Notificar cuando la ventana esté completamente cargada
    liveScreen.webContents.once('did-finish-load', () => {
      // Enviar evento a la ventana principal indicando que esta live screen está lista
      mainWindow.webContents.send('live-screen-ready', liveScreen.id)
    })

    const route = '/live-screen/' + displayId

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

  ipcMain.handle('liveScreen-update', (_event, data) => {
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      win.webContents.send('liveScreen-update', data)
    })
  })

  ipcMain.handle('liveScreen-update-theme', (_event, themeId: ThemeWithMedia) => {
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      win.webContents.send('liveScreen-update-theme', themeId)
    })
  })

  ipcMain.handle('hide-live-screen', () => {
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((win) => {
      win.webContents.send('liveScreen-hide')
    })
  })
}
