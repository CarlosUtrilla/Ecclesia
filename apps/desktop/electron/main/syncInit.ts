import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { syncCycle, syncPush, syncPull, syncStatus, syncGetAuthUrl, syncExchangeOAuthToken } from './syncBridge'

function notifyWindowsOAuthComplete(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('oauth-complete')
    }
  }
}

let isSyncing = false

export async function getIsSyncing(): Promise<boolean> {
  if (isSyncing) return true
  try {
    const status = (await syncStatus()) as any
    const cfg = status?.response ?? status
    return !!(cfg?.syncing)
  } catch {
    return false
  }
}

const RUNNING_CYCLE_POLL_MS = 300
const RUNNING_CYCLE_MAX_WAIT_MS = 5 * 60 * 1000

async function waitForRunningCycle(): Promise<void> {
  const deadline = Date.now() + RUNNING_CYCLE_MAX_WAIT_MS
  while (Date.now() < deadline) {
    const status = (await syncStatus()) as any
    const cfg = status?.response ?? status
    if (!cfg?.syncing) return
    await new Promise((resolve) => setTimeout(resolve, RUNNING_CYCLE_POLL_MS))
  }
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
      // Ciclo completo, no solo el push del oplog: los ficheros (media, miniaturas,
      // biblias) solo suben en la fase de blobs. Si hay un ciclo periódico en curso,
      // `syncCycle` lo saltaría sin hacer nada, así que primero se espera a que acabe.
      await waitForRunningCycle()
      await syncCycle()
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
  const result = (await syncGetAuthUrl()) as { authUrl?: string }
  const authUrl = result?.authUrl
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

  const filter = { urls: ['http://127.0.0.1/*'] }
  authWindow.webContents.session.webRequest.onBeforeRequest(filter, async (details, callback) => {
    const url = new URL(details.url)
    const code = url.searchParams.get('code')
    if (code) {
      try {
        await syncExchangeOAuthToken(code)
        notifyWindowsOAuthComplete()
      } catch (err) {
        log.error('[sync] Error intercambiando código OAuth:', err)
      } finally {
        authWindow.close()
      }
    }
    callback({ cancel: true })
  })
}
