import log from 'electron-log'
import { getSocket } from '../sockets/socket.service'
import { oplogService } from '../controllers/sync-oplog/oplog.service'
import { oplogLogInfo, oplogLogWarn, oplogLogError } from '../controllers/sync-oplog/oplog-logger'
import type { SyncProgress } from '../controllers/sync-oplog/oplog.types'
import type { SyncCycleResult } from '../controllers/sync-oplog/oplog.types'
import { isLiveBusy } from './live-activity.service'
import {
  evaluateCycle,
  PENDING_SYNC_DEBOUNCE_MS,
  SYNC_INTERVAL_MS,
} from './oplog-schedule-policy'

let isRunning = false
let syncTimer: ReturnType<typeof setInterval> | null = null
let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false
let lastSyncAt = 0
let deferredSince = 0

let lastProgressEmitAt = 0
/**
 * `processBlobOps` reporta progreso por cada blob y los escaneos cada 200-500 eventos:
 * cada emit es un broadcast que hace re-renderizar a todos los clientes. Se limita a
 * unos pocos por segundo, dejando pasar siempre el inicio/fin y los errores.
 */
const PROGRESS_THROTTLE_MS = 300

function notifyProgress(progress: number, message?: string, error?: boolean) {
  const now = Date.now()
  const terminal = error === true || progress <= 0 || progress >= 100
  if (!terminal && now - lastProgressEmitAt < PROGRESS_THROTTLE_MS) return
  lastProgressEmitAt = now

  try {
    getSocket().emit.syncProgress({ progress, message: message || '', error })
  } catch {
    // Socket not yet initialized
  }
}

async function ensureOplogInit(): Promise<boolean> {
  if (oplogService.isInitialized) {
    oplogLogInfo('[Scheduler] Oplog already initialized')
    return true
  }

  oplogLogInfo('[Scheduler] Calling oplogService.ensureInitialized()...')
  const ok = await oplogService.ensureInitialized()
  if (ok) {
    oplogLogInfo('[Scheduler] Oplog initialized successfully')
    log.info('[oplog-scheduler] Inicializado por ensureInitialized')
  } else {
    oplogLogWarn('[Scheduler] ensureInitialized returned false')
  }
  return ok
}

async function runSyncCycle(reason: string): Promise<SyncCycleResult | null> {
  if (isSyncing) {
    oplogLogInfo('[Scheduler] Already syncing, skipping')
    return null
  }

  const now = Date.now()
  const decision = evaluateCycle(reason, now, { lastSyncAt, deferredSince, liveBusy: isLiveBusy(now) })
  if (!decision.run) {
    if (decision.deferred && deferredSince === 0) deferredSince = now
    oplogLogInfo(
      `[Scheduler] Ciclo (${reason}) postergado por ${decision.motive}; reintento en ${Math.round(decision.retryIn / 1000)}s`,
    )
    scheduleRetry(decision.retryIn)
    return null
  }
  deferredSince = 0

  oplogLogInfo(`[Scheduler] runSyncCycle called with reason: ${reason}`)
  isSyncing = true

  try {
    oplogLogInfo('[Scheduler] Ensuring oplog init...')
    const ready = await ensureOplogInit()
    if (!ready) {
      oplogLogInfo('[Scheduler] Not configured — skipping cycle')
      log.info('[oplog-scheduler] No configurado — saltando ciclo')
      notifyProgress(0, 'No configurado')
      return null
    }

    log.warn(`\n========== [OPLOG-SYNC] INICIANDO CICLO (${reason}) ==========`)
    oplogLogInfo(`[Scheduler] Starting sync cycle: ${reason}`)

    oplogService.setOnProgress((p: SyncProgress) => {
      notifyProgress(p.progress, p.message)
    })

    oplogLogInfo('[Scheduler] Calling oplogService.syncCycle()...')
    const result = await oplogService.syncCycle()

    oplogLogInfo(`[Scheduler] syncCycle result: ${JSON.stringify(result)}`)
    if (result.errors.length > 0) {
      oplogLogWarn(`[Scheduler] Errors: ${result.errors.join(', ')}`)
      log.warn(`[oplog-sync] Errores: ${result.errors.join(', ')}`)
    }

    log.warn(`[oplog-sync] Resultado: ${result.pulled} pulled, ${result.pushed} pushed, ${result.blobsDownloaded} descargados, ${result.blobsUploaded} subidos`)
    log.warn(`\n========== [OPLOG-SYNC] CICLO FINALIZADO (${reason}) ==========`)

    lastSyncAt = Date.now()
    notifyProgress(100, 'Sincronizado')

    return result
  } catch (err: any) {
    const msg = err.message || 'Error de sincronización'
    oplogLogError(`[Scheduler] Cycle error: ${msg}`, { stack: err.stack })
    log.warn(`[oplog-sync] Error: ${msg}`)
    notifyProgress(0, msg, true)
    return null
  } finally {
    isSyncing = false
    setTimeout(() => notifyProgress(0), 500)
  }
}

function schedulePendingSync(delayMs: number = PENDING_SYNC_DEBOUNCE_MS): void {
  if (pendingSyncTimer) clearTimeout(pendingSyncTimer)
  pendingSyncTimer = setTimeout(async () => {
    pendingSyncTimer = null
    await runSyncCycle('pending')
  }, delayMs)
  pendingSyncTimer.unref?.()
}

/** Reprograma el ciclo pospuesto sin adelantar uno que ya estuviera más próximo. */
function scheduleRetry(delayMs: number): void {
  if (pendingSyncTimer) return
  schedulePendingSync(Math.max(delayMs, 1_000))
}

export function startOplogScheduler(): void {
  if (isRunning) return
  isRunning = true

  oplogLogInfo('[Scheduler] Starting oplog scheduler...')
  log.info('[oplog-scheduler] Iniciando...')

  // Startup cycle
  oplogLogInfo('[Scheduler] Running startup cycle...')
  runSyncCycle('startup')

  // Periodic sync
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    oplogLogInfo('[Scheduler] Running periodic cycle...')
    runSyncCycle('periodic')
  }, SYNC_INTERVAL_MS)

  // Event-driven: schedule sync when local events are written
  oplogLogInfo('[Scheduler] Setting onAppendEventCallback')
  // Sin log aquí: se llama en cada escritura de Prisma
  oplogService.setOnAppendEventCallback(() => {
    schedulePendingSync()
  })
  oplogLogInfo('[Scheduler] Scheduler started')
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
