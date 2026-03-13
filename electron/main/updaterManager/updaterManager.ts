import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'

autoUpdater.logger = log
autoUpdater.channel = 'latest'
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
  let isChecking = false

  async function safeCheckForUpdates() {
    if (isChecking) return null
    isChecking = true
    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      const msg = (err as Error).message ?? ''
      const isNetworkError =
        msg.includes('404') ||
        msg.includes('net::') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ERR_INTERNET_DISCONNECTED')
      log.warn('[updater] checkForUpdates falló:', msg.split('\n')[0])
      if (!isNetworkError) broadcastToAllWindows('updater:error', msg)
      broadcastToAllWindows('updater:update-not-available', null)
      return null
    } finally {
      isChecking = false
    }
  }

  // La app no está firmada (identity: null en electron-builder.yml).
  // Squirrel.Mac rechazaría la actualización al no poder satisfacer los
  // requisitos de código. Deshabilitamos esa verificación antes de configurar
  // el feed para que aplique desde el primer momento.
  if (process.platform === 'darwin') {
    ;(autoUpdater as any).verifyUpdateCodeSignature = () => Promise.resolve(null)
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'CarlosUtrilla',
    repo: 'Ecclesia',
    channel: 'latest',
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
    const isCodeSignError =
      msg.includes('did not pass validation') ||
      msg.includes('code requirements') ||
      msg.includes('satisfacer los requisitos') ||
      msg.includes('errSecCSReqFailed')

    if (isCodeSignError) {
      log.warn(
        '[updater] Error de firma de código (app sin firmar), ignorando:',
        msg.split('\n')[0]
      )
      broadcastToAllWindows('updater:update-not-available', null)
      return
    }

    const isNetworkOrAccessError =
      msg.includes('404') ||
      msg.includes('net::') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ERR_INTERNET_DISCONNECTED')

    if (isNetworkOrAccessError) {
      log.warn('[updater] Sin acceso a actualizaciones:', msg.split('\n')[0])
      // Notificar al renderer para que salga del estado "checking"
      broadcastToAllWindows('updater:update-not-available', null)
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
  ipcMain.handle('updater:check', () => safeCheckForUpdates())

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
  setTimeout(() => safeCheckForUpdates(), 10_000)
}
