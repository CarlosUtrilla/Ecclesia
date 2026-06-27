import log from 'electron-log'
import { getSocket } from '../../sockets/socket.service'
import { setOnOutboxWriteCallback, setOnMediaChangeCallback } from '../../prisma-init'
import SyncController from './sync.controller'
import { syncPushService } from './sync-push.service'
import { syncPullService } from './sync-pull.service'
import { PULL_CHECK_INTERVAL_MS, MICRO_PUSH_DEBOUNCE_MS } from './sync.config'

let isRunning = false
let pullCheckInterval: ReturnType<typeof setInterval> | null = null
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

async function fullCycle(controller: SyncController, reason: string): Promise<void> {
  log.warn(`\n========== [SYNC] INICIANDO CICLO COMPLETO (${reason}) ==========`)

  log.warn('\n--- FASE 1: PULL (descargar cambios de otros dispositivos) ---')
  notifyProgress(10, 'Pull: descargando cambios...')
  const pullResult = await controller.pull({ body: { reason } } as any)
  log.warn(`[sync] Pull completado: ${JSON.stringify(pullResult)}`)

  log.warn('\n--- FASE 2: PUSH (subir cambios locales) ---')
  notifyProgress(50, 'Push: subiendo cambios...')
  const pushResult = await controller.push({ body: { reason } } as any)
  log.warn(`[sync] Push completado: ${JSON.stringify(pushResult)}`)

  log.warn('\n--- FASE 3: HEAL (verificar archivos faltantes localmente) ---')
  notifyProgress(68, 'Heal: verificando archivos faltantes...')
  try {
    const diagnostic = await controller.diagnose()
    log.warn(`[sync] Diagnóstico: total=${diagnostic.summary.total}, ok=${diagnostic.summary.ok}, needDownload=${diagnostic.summary.needDownload}, needUpload=${diagnostic.summary.needUpload}, orphanLocal=${diagnostic.summary.orphanLocal}, tombstoned=${diagnostic.summary.tombstoned}`)
    if (diagnostic.summary.needDownload > 0) {
      notifyProgress(72, `Heal: descargando ${diagnostic.summary.needDownload} archivos faltantes...`)
      const healResult = await controller.heal({ body: { diagnostic } })
      log.warn(`[sync] Heal completado: descargados=${healResult.downloaded}, subidos=${healResult.uploaded}, errores=${healResult.errors.length}`)
    } else {
      log.warn('[sync] Heal: no hay archivos faltantes que reparar')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error desconocido'
    log.warn(`[sync] HEAL FALLÓ: ${msg}`)
  }

  log.warn('\n--- FASE 4: CLEANUP (eliminar blobs huérfanos de Drive) ---')
  notifyProgress(85, 'Cleanup: limpiando archivos huérfanos...')
  let totalDriveDeleted = 0
  let totalDriveErrors = 0
  let totalOrphans = 0
  let totalStale = 0
  let totalBytes = 0
  const MAX_CLEANUP_ITERATIONS = 10
  for (let iter = 0; iter < MAX_CLEANUP_ITERATIONS; iter++) {
    try {
      const cleanupResult = await controller.cleanupMedia()
      totalDriveDeleted += cleanupResult.driveDeleted
      totalDriveErrors += cleanupResult.driveErrors
      totalOrphans += cleanupResult.deletedOrphans
      totalStale += cleanupResult.deletedStale
      totalBytes += cleanupResult.totalFreedBytes
      log.warn(`[sync] Cleanup iter ${iter + 1}: ${cleanupResult.driveDeleted} blobs de Drive, ${cleanupResult.driveErrors} errores`)
      if (cleanupResult.driveDeleted === 0 && cleanupResult.driveErrors === 0) break
      await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error desconocido'
      log.warn(`[sync] Cleanup iter ${iter + 1} falló: ${msg}`)
      break
    }
  }
  log.warn(`[sync] Cleanup total: ${totalDriveDeleted} blobs eliminados de Drive, ${totalOrphans} huérfanos en disco, ${totalStale} stale, ${totalDriveErrors} errores, ${(totalBytes / 1024 / 1024).toFixed(2)} MB liberados`)

  log.warn('\n========== [SYNC] CICLO COMPLETO FINALIZADO ==========')
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

    if (reason === 'startup') {
      await fullCycle(controller, 'startup')
    } else if (reason === 'pull-check') {
      log.warn(`\n========== [SYNC] PULL CHECK ==========`)
      const hasChanges = await syncPullService.hasRemoteChanges()
      if (hasChanges) {
        log.warn('[sync] Pull check detectó cambios remotos — iniciando ciclo completo')
        await fullCycle(controller, 'pull-check')
      } else {
        log.warn('[sync] Pull check: sin cambios remotos, saltando ciclo')
      }
      log.warn('========== [SYNC] PULL CHECK FINALIZADO ==========')
    } else if (reason === 'micro-snapshot-push') {
      log.warn(`\n========== [SYNC] MICRO SNAPSHOT PUSH ==========`)
      notifyProgress(30, 'Subiendo snapshot...')
      await syncPushService.pushSnapshotOnly()
      log.warn('========== [SYNC] MICRO SNAPSHOT PUSH FINALIZADO ==========')
    } else if (reason === 'micro-media-push') {
      log.warn(`\n========== [SYNC] MICRO MEDIA PUSH (${reason}) ==========`)
      notifyProgress(10, 'Subiendo cambios multimedia...')
      await controller.push({ body: { reason } } as any)
      log.warn('========== [SYNC] MICRO MEDIA PUSH FINALIZADO ==========')
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

function scheduleMicroSnapshotPush(): void {
  if (mediaMicroPushTimer) {
    log.warn('[sync] Media push pendiente — saltando snapshot push (media push lo incluye)')
    return
  }
  if (microPushTimer) clearTimeout(microPushTimer)
  microPushTimer = setTimeout(async () => {
    microPushTimer = null
    try {
      await executeCycle('micro-snapshot-push')
    } catch {
      // Silently fail for micro push
    }
  }, MICRO_PUSH_DEBOUNCE_MS)
}

function scheduleMicroMediaPush(): void {
  if (microPushTimer) {
    clearTimeout(microPushTimer)
    microPushTimer = null
  }
  if (mediaMicroPushTimer) clearTimeout(mediaMicroPushTimer)
  mediaMicroPushTimer = setTimeout(async () => {
    mediaMicroPushTimer = null
    try {
      await executeCycle('micro-media-push')
    } catch {
      // Silently fail for micro-media-push
    }
  }, MICRO_PUSH_DEBOUNCE_MS)
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

  if (pullCheckInterval) clearInterval(pullCheckInterval)
  pullCheckInterval = setInterval(() => {
    executeCycle('pull-check').catch(() => {})
  }, PULL_CHECK_INTERVAL_MS)

  setOnOutboxWriteCallback(() => scheduleMicroSnapshotPush())
  setOnMediaChangeCallback(() => scheduleMicroMediaPush())
}

export function stopSyncScheduler(): void {
  isRunning = false
  if (pullCheckInterval) {
    clearInterval(pullCheckInterval)
    pullCheckInterval = null
  }
  cleanupTimers()
}
