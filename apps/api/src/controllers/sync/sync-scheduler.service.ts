import { getSocket } from '../../sockets/socket.service'
import { setOnOutboxWriteCallback, setOnMediaChangeCallback } from '../../prisma-init'
import SyncController from './sync.controller'

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000

let isRunning = false
let autoSyncInterval: ReturnType<typeof setInterval> | null = null
let microPushTimer: ReturnType<typeof setTimeout> | null = null
let mediaMicroPushTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false

function notifyProgress(progress: number, message?: string, error?: boolean) {
  try {
    getSocket().emit.syncProgress({ progress, message: message || '', error })
  } catch {
    // Socket not yet initialized
  }
}

async function executeCycle(reason: string): Promise<void> {
  if (isSyncing) return
  isSyncing = true

  try {
    notifyProgress(5, reason === 'startup' ? 'Iniciando...' : 'Sincronizando...')

    const controller = new SyncController()
    const status = await controller.getStatus()
    if (!status.connected) {
      notifyProgress(0, 'Desconectado')
      return
    }

    if (reason === 'interval' || reason === 'startup') {
      notifyProgress(10, 'Descargando cambios...')
      await controller.pull({ body: { reason } } as any)
      notifyProgress(50, 'Subiendo cambios...')
      await controller.push({ body: { reason } } as any)
    } else {
      notifyProgress(10, 'Subiendo cambios...')
      await controller.push({ body: { reason } } as any)
    }

    notifyProgress(100, 'Sincronizado')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de sincronización'
    notifyProgress(0, msg, true)
  } finally {
    isSyncing = false
    setTimeout(() => notifyProgress(0), 500)
  }
}

function scheduleMicroPush(): void {
  if (microPushTimer) clearTimeout(microPushTimer)
  microPushTimer = setTimeout(async () => {
    microPushTimer = null
    try {
      await executeCycle('micro-push')
    } catch {
      // Silently fail for micro-push
    }
  }, 1000)
}

function scheduleMicroMediaPush(): void {
  if (mediaMicroPushTimer) clearTimeout(mediaMicroPushTimer)
  mediaMicroPushTimer = setTimeout(async () => {
    mediaMicroPushTimer = null
    try {
      await executeCycle('micro-media-push')
    } catch {
      // Silently fail for micro-media-push
    }
  }, 1000)
}

function cleanupTimers(): void {
  if (microPushTimer) {
    clearTimeout(microPushTimer)
    microPushTimer = null
  }
  if (mediaMicroPushTimer) {
    clearTimeout(mediaMicroPushTimer)
    mediaMicroPushTimer = null
  }
}

export function startSyncScheduler(): void {
  if (isRunning) return
  isRunning = true

  executeCycle('startup').catch(() => {})

  if (autoSyncInterval) clearInterval(autoSyncInterval)
  autoSyncInterval = setInterval(() => {
    executeCycle('interval').catch(() => {})
  }, AUTO_SYNC_INTERVAL_MS)

  setOnOutboxWriteCallback(() => scheduleMicroPush())
  setOnMediaChangeCallback(() => {
    scheduleMicroMediaPush()
    scheduleMicroPush()
  })
}

export function stopSyncScheduler(): void {
  isRunning = false
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval)
    autoSyncInterval = null
  }
  cleanupTimers()
}
