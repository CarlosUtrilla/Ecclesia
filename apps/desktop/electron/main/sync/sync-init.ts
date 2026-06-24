import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { syncPush, syncPull, syncStatus, syncGetAuthUrl, syncExchangeOAuthToken } from '../syncBridge'

let isSyncing = false

export function getIsSyncing(): boolean {
  return isSyncing
}

export async function executeSyncCycle(reason: string): Promise<void> {
  if (isSyncing) return

  isSyncing = true

  try {
    const status = (await syncStatus()) as any
    const config = status?.response ?? status
    const isEnabled = config?.enabled ?? config?.connected ?? false
    if (!isEnabled) return

    if (reason === 'close') {
      await syncPush()
    } else {
      await syncPull()
      await syncPush()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error en ciclo de sync'
    log.error(`[sync] Error en ciclo ${reason}:`, msg)
  } finally {
    isSyncing = false
  }
}

export async function showOAuthWindow(): Promise<void> {
  const authUrl = (await syncGetAuthUrl()) as string
  if (!authUrl) {
    log.error('[sync] No se pudo obtener URL de autenticación')
    return
  }

  const authWindow = new BrowserWindow({
    width: 600,
    height: 700,
    title: 'Conectar con Google Drive',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  authWindow.loadURL(authUrl)

  authWindow.webContents.on('will-redirect', async (_event, url) => {
    const code = new URL(url).searchParams.get('code')
    if (code) {
      try {
        await syncExchangeOAuthToken(code)
        authWindow.close()
      } catch (err) {
        log.error('[sync] Error intercambiando código OAuth:', err)
      }
    }
  })

  authWindow.webContents.on('will-navigate', async (_event, url) => {
    const code = new URL(url).searchParams.get('code')
    if (code) {
      try {
        await syncExchangeOAuthToken(code)
        authWindow.close()
      } catch (err) {
        log.error('[sync] Error intercambiando código OAuth:', err)
      }
    }
  })
}
