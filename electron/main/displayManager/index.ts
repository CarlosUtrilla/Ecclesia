import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
const liveScreensByDisplayId = new Map<number, BrowserWindow>()
const stageScreensByDisplayId = new Map<number, BrowserWindow>()

function focusDisplayWindow(windowRef: BrowserWindow): number {
  if (windowRef.isMinimized()) {
    windowRef.restore()
  }
  windowRef.show()
  windowRef.focus()
  windowRef.setAlwaysOnTop(true, 'screen-saver')
  return windowRef.id
}

const rendererReadyResolvers = new Map<number, () => void>()

export function initializeDisplayManager() {
  ipcMain.on('renderer-ready', (event) => {
    const resolve = rendererReadyResolvers.get(event.sender.id)
    if (resolve) {
      rendererReadyResolvers.delete(event.sender.id)
      resolve()
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
      aspectRatio: display.bounds.width / display.bounds.height,
      isMain: display.id === screen.getPrimaryDisplay().id
    }))
  })

  // listener para ver cuando se conecta o desconecta una pantalla
  screen.on('display-added', () => {
    console.log('Display added')
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('display-update')
    })
  })
  screen.on('display-removed', () => {
    console.log('Display removed')
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('display-update')
    })
  })

  // Abrir ventana en pantalla completa en la pantalla especificada
  ipcMain.handle('show-live-screen', (event, displayId: number) => {
    const existingLiveScreen = liveScreensByDisplayId.get(displayId)
    if (existingLiveScreen && !existingLiveScreen.isDestroyed()) {
      return focusDisplayWindow(existingLiveScreen)
    }

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
        sandbox: false,
        backgroundThrottling: false
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

    const route = '/live-screen/' + displayId

    const liveScreenWebContentsId = liveScreen.webContents.id
    liveScreensByDisplayId.set(displayId, liveScreen)
    liveScreen.on('closed', () => {
      liveScreensByDisplayId.delete(displayId)
      rendererReadyResolvers.delete(liveScreenWebContentsId)
    })

    const loadPromise = new Promise<number>((resolve) => {
      rendererReadyResolvers.set(liveScreen.webContents.id, () => {
        mainWindow.webContents.send('live-screen-ready', liveScreen.id)
        resolve(liveScreen.id)
      })
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      liveScreen.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
    } else {
      liveScreen.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: route
      })
    }

    return loadPromise
  })

  ipcMain.handle('show-stage-screen', (event, displayId: number) => {
    const existingStageScreen = stageScreensByDisplayId.get(displayId)
    if (existingStageScreen && !existingStageScreen.isDestroyed()) {
      return focusDisplayWindow(existingStageScreen)
    }

    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) {
      throw new Error('No se pudo obtener la ventana principal')
    }

    const displays = screen.getAllDisplays()
    const targetDisplay = displays.find((display) => display.id === displayId)

    if (!targetDisplay) {
      throw new Error(`Display con ID ${displayId} no encontrado`)
    }

    const stageScreen = new BrowserWindow({
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
      simpleFullscreen: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        backgroundThrottling: false
      }
    })

    stageScreen.once('ready-to-show', () => {
      stageScreen.show()
      stageScreen.focus()
      stageScreen.setAlwaysOnTop(true, 'screen-saver')

      if (process.platform === 'darwin') {
        stageScreen.setSimpleFullScreen(true)
        stageScreen.setAutoHideMenuBar(true)
      }

      setTimeout(() => {
        mainWindow.focus()
        mainWindow.show()
      }, 250)
    })

    const route = '/stage-screen/' + displayId

    const stageScreenWebContentsId = stageScreen.webContents.id
    stageScreensByDisplayId.set(displayId, stageScreen)
    stageScreen.on('closed', () => {
      stageScreensByDisplayId.delete(displayId)
      rendererReadyResolvers.delete(stageScreenWebContentsId)
    })

    const loadPromise = new Promise<number>((resolve) => {
      rendererReadyResolvers.set(stageScreen.webContents.id, () => {
        mainWindow.webContents.send('stage-screen-ready', stageScreen.id)
        resolve(stageScreen.id)
      })
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      stageScreen.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
    } else {
      stageScreen.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: route
      })
    }

    return loadPromise
  })

  // Cerrar ventana por su ID
  ipcMain.handle('close-live-screen', (_event, windowId: number) => {
    const window = BrowserWindow.fromId(windowId)

    if (!window) {
      log.warn(`close-live-screen: ventana con ID ${windowId} ya cerrada, ignorando`)
      return
    }

    // Enfoque más agresivo para cerrar ventanas fullscreen
    try {
      for (const [displayId, liveScreen] of liveScreensByDisplayId.entries()) {
        if (liveScreen.id === windowId) {
          liveScreensByDisplayId.delete(displayId)
          break
        }
      }

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

  ipcMain.handle('close-stage-screen', (_event, windowId: number) => {
    const window = BrowserWindow.fromId(windowId)

    if (!window) {
      log.warn(`close-stage-screen: ventana con ID ${windowId} ya cerrada, ignorando`)
      return
    }

    try {
      for (const [displayId, stageScreen] of stageScreensByDisplayId.entries()) {
        if (stageScreen.id === windowId) {
          stageScreensByDisplayId.delete(displayId)
          break
        }
      }

      if (process.platform === 'darwin') {
        window.setSimpleFullScreen(false)
      }
      window.setFullScreen(false)
      window.setAlwaysOnTop(false)
      window.setClosable(true)
      window.destroy()
      return true
    } catch (error) {
      console.error('Error closing stage screen:', error)
      try {
        window.destroy()
        return true
      } catch (destroyError) {
        console.error('Error destroying stage screen:', destroyError)
        return false
      }
    }
  })

  ipcMain.handle('liveScreen-update', (_event, data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('liveScreen-update', data)
    })
  })

  ipcMain.handle('liveScreen-update-theme', (_event, themeId: ThemeWithMedia) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('liveScreen-update-theme', themeId)
    })
  })

  ipcMain.handle('stageScreen-config-update', (_event, data: StageScreenConfigUpdate) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('stageScreen-config-updated', data)
    })
  })

  ipcMain.handle('hide-live-screen', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('liveScreen-hide')
    })
  })
  // Handler para abrir la ventana de gestión de pantallas
  ipcMain.handle('show-new-display-connected', (event) => {
    const callerWindow = BrowserWindow.fromWebContents(event.sender)
    if (callerWindow) {
      callerWindow.webContents.send('open-new-display-connected')
      return
    }

    // Fallback defensivo: usa una ventana no-live si existe.
    const targetWindow = BrowserWindow.getAllWindows().find(
      (win) =>
        !win.webContents.getURL().includes('/live-screen/') &&
        !win.webContents.getURL().includes('/stage-screen/')
    )
    if (targetWindow) {
      targetWindow.webContents.send('open-new-display-connected')
    }
    return
  })
}
