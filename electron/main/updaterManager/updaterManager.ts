import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'

autoUpdater.logger = log
autoUpdater.channel = 'beta'
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function broadcastToAllWindows(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  })
}

export function initializeUpdaterManager(): void {
  autoUpdater.on('checking-for-update', () => {
    broadcastToAllWindows('updater:checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    broadcastToAllWindows('updater:update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcastToAllWindows('updater:update-not-available', info)
  })

  autoUpdater.on('error', (err) => {
    broadcastToAllWindows('updater:error', err.message)
    log.error('Error en auto-updater:', err)
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcastToAllWindows('updater:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcastToAllWindows('updater:update-downloaded', info)
  })

  // Canal IPC para verificar actualizaciones manualmente
  ipcMain.handle('updater:check', async () => {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      log.error('Error al verificar actualizaciones:', err)
      return null
    }
  })

  // Canal IPC para iniciar descarga
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      log.error('Error al descargar actualización:', err)
    }
  })

  // Canal IPC para instalar y reiniciar
  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Canal IPC para obtener la versión actual
  ipcMain.handle('updater:get-version', () => {
    return autoUpdater.currentVersion.version
  })

  // Verificar actualizaciones automáticamente al iniciar (con delay para no bloquear el arranque)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('Verificación de actualizaciones automática falló:', err.message)
    })
  }, 10_000)
}
