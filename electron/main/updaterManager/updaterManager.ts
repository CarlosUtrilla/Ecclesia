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

declare const __GH_TOKEN__: string

function resolveGhToken(): string | null {
  // Token inyectado en build time (no visible en filesystem)
  if (typeof __GH_TOKEN__ !== 'undefined' && __GH_TOKEN__) return __GH_TOKEN__
  // Fallback: variable de entorno del sistema (CI/dev)
  if (process.env['GH_TOKEN']) return process.env['GH_TOKEN']
  return null
}

export function initializeUpdaterManager(): void {
  const token = resolveGhToken()

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'CarlosUtrilla',
    repo: 'Ecclesia',
    channel: 'beta',
    private: true,
    token: token ?? undefined
  })

  if (token) {
    log.info('[updater] Token de GitHub configurado')
  } else {
    log.warn('[updater] No se encontró GH_TOKEN — las actualizaciones pueden no funcionar')
  }

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
    // Ignorar errores de red/acceso (repo privado, sin releases, sin conexión)
    // para no generar ruido en los logs y no molestar al usuario
    const msg = err.message ?? ''
    const isNetworkOrAccessError =
      msg.includes('404') ||
      msg.includes('net::') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ERR_INTERNET_DISCONNECTED')

    if (isNetworkOrAccessError) {
      log.warn('[updater] Sin acceso a actualizaciones:', msg.split('\n')[0])
      return
    }

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
      const msg = (err?.message ?? '') as string
      if (!msg.includes('404') && !msg.includes('net::') && !msg.includes('ENOTFOUND')) {
        log.warn('Verificación de actualizaciones automática falló:', msg)
      }
    })
  }, 10_000)
}
