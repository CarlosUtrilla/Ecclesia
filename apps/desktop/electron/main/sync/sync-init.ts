import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { checkApiHealth, syncPush, syncPull, syncStatus } from '../syncBridge'
import { registerSyncIpcHandlers, setNotifySyncState, getOrCreateAuthUrl, exchangeOAuthCode } from './sync-ipc'
import { setOnOutboxWriteCallback, setOnMediaChangeCallback } from '../prisma'

// Scheduler state
let autoSyncInterval: ReturnType<typeof setInterval> | null = null
let schedulerHealthInterval: ReturnType<typeof setInterval> | null = null
let lastSchedulerHeartbeat = Date.now()
let isSyncing = false
let syncInProgressPromise: Promise<void> | null = null
let isQuitting = false
let microPushTimer: ReturnType<typeof setTimeout> | null = null
let mediaMicroPushTimer: ReturnType<typeof setTimeout> | null = null

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000
const SCHEDULER_STALE_THRESHOLD_MS = AUTO_SYNC_INTERVAL_MS * 2 + 30 * 1000

function notifySyncState(syncing: boolean, progress = 0, error?: string) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('sync-state', { syncing, progress, error })
    }
  })
}

export function getIsSyncing(): boolean {
  return isSyncing
}

export async function executeSyncCycle(reason: string): Promise<void> {
  if (isSyncing) {
    if (reason !== 'close') return
    await syncInProgressPromise
  }

  isSyncing = true
  syncInProgressPromise = null
  lastSchedulerHeartbeat = Date.now()
  notifySyncState(true, 5)

  const cyclePromise = (async () => {
    try {
      const apiOk = await checkApiHealth()
      if (!apiOk) {
        log.warn('[sync] API no disponible, saltando ciclo')
        notifySyncState(false, 0, 'API no disponible')
        return
      }

      const status = (await syncStatus()) as any
      const config = status?.response ?? status
      const isEnabled = config?.enabled ?? config?.connected ?? false
      if (!isEnabled) {
        notifySyncState(false)
        return
      }

      if (reason === 'manual-pull' || reason === 'interval' || reason === 'startup' || reason === 'close') {
        notifySyncState(true, 10)
        const pullResult = await syncPull()
        notifySyncState(true, 50)
        log.warn(`[sync] Pull completado: ${JSON.stringify(pullResult)}`)
        const pushResult = await syncPush()
        log.warn(`[sync] Push completado: ${JSON.stringify(pushResult)}`)
      } else {
        notifySyncState(true, 10)
        const pushResult = await syncPush()
        log.warn(`[sync] Push completado: ${JSON.stringify(pushResult)}`)
      }

      notifySyncState(true, 100)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en ciclo de sync'
      log.error(`[sync] Error en ciclo ${reason}:`, msg)
      notifySyncState(false, 0, msg)
    } finally {
      isSyncing = false
      setTimeout(() => notifySyncState(false), 500)
    }
  })()

  syncInProgressPromise = cyclePromise
  await cyclePromise
}

function scheduleMicroPush(): void {
  if (microPushTimer) clearTimeout(microPushTimer)
  microPushTimer = setTimeout(async () => {
    microPushTimer = null
    try {
      if (!(await checkApiHealth())) return
      await syncPush()
    } catch (err) {
      log.error('[sync] micro-push falló:', err)
    }
  }, 1000)
}

function scheduleMicroMediaPush(): void {
  if (mediaMicroPushTimer) clearTimeout(mediaMicroPushTimer)
  mediaMicroPushTimer = setTimeout(async () => {
    mediaMicroPushTimer = null
    try {
      if (!(await checkApiHealth())) return
      await syncPush()
    } catch (err) {
      log.error('[sync] micro-media-push falló:', err)
    }
  }, 1000)
}

function clearScheduledRetry(): void {
  // Retry is now handled server-side via syncStateService
}

export async function showOAuthWindow(): Promise<void> {
  const authUrl = (await getOrCreateAuthUrl()) as string
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
        await exchangeOAuthCode(code)
        authWindow.close()
      } catch (err) {
        log.error('[sync] Error intercambiando código OAuth:', err)
      }
    }
  })

  // Fallback for when will-redirect doesn't fire (e.g., page navigation instead of redirect)
  authWindow.webContents.on('will-navigate', async (_event, url) => {
    const code = new URL(url).searchParams.get('code')
    if (code) {
      try {
        await exchangeOAuthCode(code)
        authWindow.close()
      } catch (err) {
        log.error('[sync] Error intercambiando código OAuth:', err)
      }
    }
  })
}

export function initializeSyncManager(): void {
  lastSchedulerHeartbeat = Date.now()
  setNotifySyncState(notifySyncState)

  // Register all IPC handlers
  registerSyncIpcHandlers()

  // Start cycle on startup
  executeSyncCycle('startup').catch((err) => {
    const msg = err instanceof Error ? err.message : 'Error en inicio de sync'
    notifySyncState(false, 0, msg)
  })

  // Set up auto-sync interval
  if (autoSyncInterval) clearInterval(autoSyncInterval)
  if (schedulerHealthInterval) clearInterval(schedulerHealthInterval)
  clearScheduledRetry()

  autoSyncInterval = setInterval(() => {
    executeSyncCycle('interval').catch((err) => {
      const msg = err instanceof Error ? err.message : 'Error en sync automático'
      notifySyncState(false, 0, msg)
    })
  }, AUTO_SYNC_INTERVAL_MS)

  schedulerHealthInterval = setInterval(() => {
    const lag = Date.now() - lastSchedulerHeartbeat
    if (lag > SCHEDULER_STALE_THRESHOLD_MS) {
      log.warn(`[sync] Scheduler heartbeat stale: ${lag}ms`)
    }
  }, HEALTH_CHECK_INTERVAL_MS)

  // Wire micro-push callbacks
  setOnOutboxWriteCallback(() => scheduleMicroPush())
  setOnMediaChangeCallback(() => {
    scheduleMicroMediaPush()
    scheduleMicroPush()
  })

  // Auto-save event from renderer
  ipcMain.on('sync:google-drive:auto-save-event', () => {
    scheduleMicroPush()
  })

  // Micro-push media from renderer
  ipcMain.handle('sync:google-drive:micro-push-media', () => {
    scheduleMicroMediaPush()
  })

  // Before-quit hook
  app.on('before-quit', async (event) => {
    if (isQuitting) return
    event.preventDefault()
    isQuitting = true

    try {
      await executeSyncCycle('close')
    } catch {
      notifySyncState(false)
    }

    app.quit()
  })
}


