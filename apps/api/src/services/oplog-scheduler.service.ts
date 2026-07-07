import log from 'electron-log'
import { getSocket } from '../sockets/socket.service'
import { oplogService } from '../controllers/sync-oplog/oplog.service'
import type { SyncProgress } from '../controllers/sync-oplog/oplog.types'
import type { SyncCycleResult } from '../controllers/sync-oplog/oplog.types'

let isRunning = false
let syncTimer: ReturnType<typeof setInterval> | null = null
let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false
let lastSyncAt = 0

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const PENDING_SYNC_DEBOUNCE_MS = 30_000

function notifyProgress(progress: number, message?: string, error?: boolean) {
  try {
    getSocket().emit.syncProgress({ progress, message: message || '', error })
  } catch {
    // Socket not yet initialized
  }
}

async function ensureOplogInit(): Promise<boolean> {
  if (oplogService.isInitialized) return true

  const ok = await oplogService.ensureInitialized()
  if (ok) log.info('[oplog-scheduler] Inicializado por ensureInitialized')
  return ok
}

async function runSyncCycle(reason: string): Promise<SyncCycleResult | null> {
  if (isSyncing) return null
  isSyncing = true

  try {
    const ready = await ensureOplogInit()
    if (!ready) {
      log.info('[oplog-scheduler] No configurado — saltando ciclo')
      notifyProgress(0, 'No configurado')
      return null
    }

    log.warn(`\n========== [OPLOG-SYNC] INICIANDO CICLO (${reason}) ==========`)

    oplogService.setOnProgress((p: SyncProgress) => {
      notifyProgress(p.progress, p.message)
    })

    const result = await oplogService.syncCycle()

    if (result.errors.length > 0) {
      log.warn(`[oplog-sync] Errores: ${result.errors.join(', ')}`)
    }

    log.warn(`[oplog-sync] Resultado: ${result.pulled} pulled, ${result.pushed} pushed, ${result.blobsDownloaded} descargados, ${result.blobsUploaded} subidos`)
    log.warn(`\n========== [OPLOG-SYNC] CICLO FINALIZADO (${reason}) ==========`)

    lastSyncAt = Date.now()
    notifyProgress(100, 'Sincronizado')

    return result
  } catch (err: any) {
    const msg = err.message || 'Error de sincronización'
    log.warn(`[oplog-sync] Error: ${msg}`)
    notifyProgress(0, msg, true)
    return null
  } finally {
    isSyncing = false
    setTimeout(() => notifyProgress(0), 500)
  }
}

function schedulePendingSync(): void {
  if (pendingSyncTimer) clearTimeout(pendingSyncTimer)
  pendingSyncTimer = setTimeout(async () => {
    pendingSyncTimer = null
    await runSyncCycle('pending')
  }, PENDING_SYNC_DEBOUNCE_MS)
}

export function startOplogScheduler(): void {
  if (isRunning) return
  isRunning = true

  log.info('[oplog-scheduler] Iniciando...')

  // Startup cycle
  runSyncCycle('startup')

  // Periodic sync
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    runSyncCycle('periodic')
  }, SYNC_INTERVAL_MS)

  // Event-driven: schedule sync when local events are written
  oplogService.setOnAppendEventCallback(() => schedulePendingSync())
}

export function stopOplogScheduler(): void {
  isRunning = false
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer)
    pendingSyncTimer = null
  }
  oplogService.setOnAppendEventCallback(null)
}
