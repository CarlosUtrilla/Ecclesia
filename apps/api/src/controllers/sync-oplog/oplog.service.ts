import {
  from, change, merge, clone, save, load,
  type Doc,
} from '@automerge/automerge'
import { randomUUID, randomBytes } from 'crypto'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import { getPrisma } from '../../prisma'
import { oplogStateService } from './oplog-state.service'
import { oplogDriveService, OplogConcurrencyError } from './oplog-drive.service'
import { oplogReplayService } from './oplog-replay.service'
import { oplogBlobService } from './oplog-blob.service'
import { oplogMigrationService } from './oplog-migration.service'
import { oplogPurgeService } from './oplog-purge.service'
import { computeSchemaHash } from './oplog-utils'
import { readJsonSafe, getAppInstanceIdFilePath, getMediaDir } from './oplog-shared'
import { getSocket } from '../../sockets/socket.service'
import log from 'electron-log'
import { oplogLogInfo, oplogLogWarn, oplogLogError } from './oplog-logger'
import { buildThumbnailFileName, generateImageThumbnail, generateVideoThumbnail, buildFallbackFileName, generateVideoFallback } from '../../mediaThumbnails'
import type {
  OplogDocument, OplogEvent, OplogConfig, EntityType,
  SyncCycleResult, SyncProgress,
} from './oplog.types'

const ENTITY_TYPE_TO_QUERY_KEY: Partial<Record<EntityType, string[]>> = {
  song: ['songs'],
  tagSongs: ['tagSongs'],
  media: ['media', 'folders'],
  font: ['fonts'],
  themes: ['themes'],
  presentation: ['presentations'],
  biblePresentationSettings: ['biblePresentationSettings'],
  setting: ['settings'],
  schedule: ['schedules'],
  scheduleGroupTemplate: ['scheduleGroupTemplates'],
  scheduleItem: ['schedules'],
  selectedScreens: ['selectedScreens'],
  stageScreenConfig: ['stageScreenConfig'],
}

function collectInvalidateKeys(ops: OplogEvent[]): string[][] {
  const keys = new Set<string>()
  for (const op of ops) {
    const queryKey = ENTITY_TYPE_TO_QUERY_KEY[op.entityType]
    if (queryKey) {
      for (const k of queryKey) keys.add(k)
    }
  }
  if (keys.size === 0) return []
  return Array.from(keys).map((k) => [k])
}

function emitInvalidateQueries(ops: OplogEvent[]): void {
  const keys = collectInvalidateKeys(ops)
  if (keys.length === 0) return
  try {
    getSocket().emit.queryKeysInvalidate({ keys })
  } catch { /* socket no listo */ }
}

export type SyncEventCallback = (progress: SyncProgress) => void

// Debounce para coalescer la escritura del oplog a disco. La mutación en memoria
// del doc Automerge es inmediata; solo la serialización completa (save()) + writeFile
// se difieren para no bloquear la respuesta de cada escritura de Prisma.
const PERSIST_DEBOUNCE_MS = 400

export class OplogService {
  private localDoc: Doc<OplogDocument> | null = null
  private currentSeq = 0
  private pendingEvents: OplogEvent[] = []
  private onProgress: SyncEventCallback | null = null
  private blobFallbackDone = false
  private checksumCache = new Map<string, string>()
  private onAppendEventCallback: (() => void) | null = null
  private config: OplogConfig | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private persistPromise: Promise<void> | null = null
  private persistDirty = false

  get isInitialized(): boolean {
    return this.localDoc !== null
  }

  setOnProgress(cb: SyncEventCallback): void {
    this.onProgress = cb
  }

  setOnAppendEventCallback(cb: (() => void) | null): void {
    this.onAppendEventCallback = cb
  }

  async purge(retentionDays?: number): Promise<{ purged: Record<string, number>; totalPurged: number }> {
    if (!this.config) throw new Error('Oplog not initialized')
    const result = await oplogPurgeService.purgeSoftDeleted(this.config, retentionDays)
    this.config.lastPurgeAt = new Date().toISOString()
    await oplogStateService.writeConfig(this.config)
    return result
  }

  private emitProgress(phase: SyncProgress['phase'], progress: number, message: string): void {
    this.onProgress?.({ phase, progress, message })
  }

  private async runMappedPhase<T>(
    phase: SyncProgress['phase'],
    label: string,
    startPct: number,
    endPct: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prevCb = this.onProgress
    this.onProgress = (p: SyncProgress) => {
      const mapped = startPct + Math.round((p.progress / 100) * (endPct - startPct))
      prevCb?.({ phase, progress: Math.min(mapped, endPct), message: `${label} — ${p.message}` })
    }
    try {
      return await fn()
    } finally {
      this.onProgress = prevCb
    }
  }

  async init(deviceId: string): Promise<void> {
    oplogLogInfo(`[DIAG-INIT] init() called deviceId=${deviceId}`)
    log.warn(`[DIAG-INIT] init() called deviceId=${deviceId}`)
    this.config = {
      deviceId,
      deviceName: os.hostname(),
      lastPushAt: null,
      lastPullAt: null,
      lastSyncAt: null,
      lastRemoteGeneration: null,
      lastPurgeAt: null,
    }

    const existing = await oplogStateService.readOplogBinary()
    oplogLogInfo(`[OplogInit] readOplogBinary: ${existing ? existing.length + ' bytes' : 'null'}`)
    if (existing && existing.length > 0) {
      try {
        this.localDoc = load<OplogDocument>(existing)
        oplogLogInfo('[OplogInit] Local OpLog loaded successfully')
      } catch (e: any) {
        oplogLogWarn('[OplogInit] Local OpLog corrupto — bootstrapping desde DB local', { error: e.message })
        log.warn('[OplogInit] Local OpLog corrupto — bootstrapping desde DB local')
        this.localDoc = null
      }

      if (this.localDoc) {
        const ops = this.localDoc.ops ?? []
        oplogLogInfo(`[OplogInit] Local OpLog has ${ops.length} operations`)
        if (ops.length > 0) {
          this.currentSeq = ops.reduce((max, e) => Math.max(max, e.seq ?? 0), 0)
          oplogLogInfo(`[OplogInit] currentSeq set to ${this.currentSeq}`)

          const replayState = await oplogStateService.readReplayState()
          oplogLogInfo(`[OplogInit] replayState: ${replayState ? JSON.stringify(replayState) : 'null'}`)
          if (replayState) {
            const newEvents = ops.slice(replayState.lastAppliedIndex === -1 ? 0 : replayState.lastAppliedIndex + 1)
            oplogLogInfo(`[OplogInit] ${newEvents.length} new events to apply from replay`)
            if (newEvents.length > 0) {
              this.emitProgress('pull', 0, `Aplicando ${newEvents.length} eventos pendientes...`)
              const result = await oplogReplayService.applyEvents(newEvents)
              emitInvalidateQueries(newEvents)
              if (result.errors.length > 0) {
                oplogLogWarn(`[OplogInit] ${result.errors.length} errores al aplicar eventos locales pendientes:`)
                log.warn(`[OplogInit] ${result.errors.length} errores al aplicar eventos locales pendientes:`)
                for (const err of result.errors.slice(0, 20)) {
                  oplogLogWarn(`  ${err}`)
                  log.warn(`  ${err}`)
                }
                if (result.errors.length > 20) {
                  oplogLogWarn(`  ... y ${result.errors.length - 20} más`)
                  log.warn(`  ... y ${result.errors.length - 20} más`)
                }
              }
              replayState.lastAppliedIndex = ops.length - 1
              replayState.lastAppliedEventId = newEvents[newEvents.length - 1]?.id ?? null
              replayState.appliedAt = new Date().toISOString()
              await oplogStateService.writeReplayState(replayState)
              oplogLogInfo('[OplogInit] Replay state updated')
            }
          } else {
            // No replay state — aplicar todos los eventos desde 0
            oplogLogInfo('[OplogInit] No replay state found, applying all events from 0')
            this.emitProgress('pull', 0, `Aplicando ${ops.length} eventos desde 0...`)
            const result = await oplogReplayService.applyEvents(ops)
            emitInvalidateQueries(ops)
            if (result.errors.length > 0) {
              oplogLogWarn(`[OplogInit] ${result.errors.length} errores al aplicar todos los eventos locales:`)
              log.warn(`[OplogInit] ${result.errors.length} errores al aplicar todos los eventos locales:`)
              for (const err of result.errors.slice(0, 20)) {
                oplogLogWarn(`  ${err}`)
                log.warn(`  ${err}`)
              }
              if (result.errors.length > 20) {
                oplogLogWarn(`  ... y ${result.errors.length - 20} más`)
                log.warn(`  ... y ${result.errors.length - 20} más`)
              }
            }
            await oplogStateService.writeReplayState({
              lastAppliedIndex: ops.length - 1,
              lastAppliedEventId: ops[ops.length - 1]?.id ?? null,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })
            oplogLogInfo('[OplogInit] Replay state created')
          }

          await this.backfillChecksums()

          const savedConfig = await oplogStateService.readConfig()
          oplogLogInfo(`[OplogInit] savedConfig: ${savedConfig ? JSON.stringify(savedConfig) : 'null'}`)
          if (savedConfig) {
            this.config = { ...this.config, ...savedConfig }
          }

          // Poblar pendingEvents con todos los ops para que push() los suba a Drive
          this.pendingEvents = [...(this.localDoc.ops ?? [])]
          oplogLogInfo(`[OplogInit] pendingEvents populated with ${this.pendingEvents.length} events`)
          return
        }
        oplogLogInfo('[OplogInit] Local OpLog vacío — bootstrapping desde DB local')
        log.info('[OplogInit] Local OpLog vacío — bootstrapping desde DB local')
        this.localDoc = null
      }
    }

    // No local OpLog — intentar descargar desde Drive (PC secundaria virgen)
    oplogLogInfo('[OplogInit] No local OpLog, checking Drive availability...')
    const driveAvailable = await oplogDriveService.isAvailable()
    oplogLogInfo(`[OplogInit] Drive isAvailable: ${driveAvailable}`)
    if (driveAvailable) {
      try {
        oplogLogInfo('[OplogInit] Attempting to download remote OpLog...')
        const remote = await oplogDriveService.downloadOplog()
        oplogLogInfo(`[OplogInit] Remote OpLog download result: ${remote ? 'found (' + remote.data.length + ' bytes, gen=' + remote.generation + ')' : 'not found'}`)
        if (remote) {
          const remoteDoc = load<OplogDocument>(remote.data)
          const ops = remoteDoc.ops ?? []
          oplogLogInfo(`[OplogInit] Remote OpLog has ${ops.length} operations`)

          if (ops.length === 0) {
            // Remote OpLog is empty — ignore and bootstrap from local DB
            oplogLogInfo('[OplogInit] Remote OpLog vacío — bootstrapping desde DB local')
            log.info('[OplogInit] Remote OpLog vacío — bootstrapping desde DB local')
          } else {
            this.emitProgress('pull', 10, 'OpLog remoto encontrado, descargando...')
            this.localDoc = remoteDoc
            this.currentSeq = ops.reduce((max, e) => Math.max(max, e.seq ?? 0), 0)
            oplogLogInfo(`[OplogInit] Remote doc loaded, currentSeq=${this.currentSeq}`)
            await this.persistLocal()

            this.config.lastRemoteGeneration = remote.generation
            this.config.lastPullAt = new Date().toISOString()

            // Diagnostic: contar eventos media con thumbnailChecksum
            const mediaOps = ops.filter(o => o.entityType === 'media')
            const mediaWithThumbnail = mediaOps.filter(o => !!o.thumbnailChecksum)
            oplogLogInfo(`[OplogInit-DIAG] Remote ops: ${ops.length} total, ${mediaOps.length} media, ${mediaWithThumbnail.length} media with thumbnailChecksum`)
            if (mediaWithThumbnail.length < mediaOps.length) {
              oplogLogWarn(`[OplogInit-DIAG] ${mediaOps.length - mediaWithThumbnail.length} media ops MISSING thumbnailChecksum in remote doc!`)
            }

            // Replicar todos los eventos a la DB local
            this.emitProgress('pull', 40, `Aplicando ${ops.length} eventos...`)
            oplogLogInfo(`[OplogInit] Applying ${ops.length} remote events to local DB...`)
            let applyResult
            try {
              applyResult = await oplogReplayService.applyEvents(ops)
            } catch (applyErr: any) {
              oplogLogError(`[OplogInit] applyEvents CRASHED: ${applyErr.message}`, { stack: applyErr.stack })
              log.error(`[OplogInit] applyEvents CRASHED: ${applyErr.message}`)
              this.emitProgress('pull', 100, `Error: ${applyErr.message}`)
              return
            }
            emitInvalidateQueries(ops)
            oplogLogInfo(`[OplogInit] Apply result: ${applyResult.applied} applied, ${applyResult.errors.length} errors, ${applyResult.blobOps.length} blobOps`)

            const thumbnailOps = applyResult.blobOps.filter((b: any) => b.path?.startsWith('thumbnails/'))
            oplogLogInfo(`[OplogInit] Blob ops: ${applyResult.blobOps.length} total, ${thumbnailOps.length} thumbnails, ${applyResult.blobOps.length - thumbnailOps.length} files`)

            if (applyResult.errors.length > 0) {
              oplogLogWarn(`[OplogInit] ${applyResult.errors.length} errores al aplicar eventos remotos:`)
              log.warn(`[OplogInit] ${applyResult.errors.length} errores al aplicar eventos remotos:`)
              for (const err of applyResult.errors.slice(0, 20)) {
                oplogLogWarn(`  ${err}`)
                log.warn(`  ${err}`)
              }
              if (applyResult.errors.length > 20) {
                oplogLogWarn(`  ... y ${applyResult.errors.length - 20} más`)
                log.warn(`  ... y ${applyResult.errors.length - 20} más`)
              }
            }
            this.emitProgress('pull', 90, `${applyResult.applied} eventos replicados`)

            if (applyResult.blobOps.length > 0) {
              oplogLogInfo(`[OplogInit] Processing ${applyResult.blobOps.length} blob ops...`)
              this.emitProgress('blob', 50, `Sincronizando ${applyResult.blobOps.length} blobs...`)
              try {
                const blobResult = await oplogBlobService.processBlobOps(applyResult.blobOps)
                oplogLogInfo(`[OplogInit] Blob ops processed: ${blobResult.downloaded} downloaded, ${blobResult.uploaded} uploaded`)
              } catch (blobErr: any) {
                oplogLogError(`[OplogInit] processBlobOps CRASHED: ${blobErr.message}`, { stack: blobErr.stack })
                log.error(`[OplogInit] processBlobOps CRASHED: ${blobErr.message}`)
              }
            }

            await oplogStateService.writeReplayState({
              lastAppliedIndex: ops.length - 1,
              lastAppliedEventId: ops[ops.length - 1]?.id ?? null,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })

            this.emitProgress('pull', 100, 'OpLog remoto replicado a DB local')
            oplogLogInfo('[OplogInit] Remote OpLog fully replicated')
          }
        }
      } catch (err: any) {
        oplogLogWarn('[OplogInit] No se pudo descargar OpLog remoto', { error: err.message, stack: err.stack })
        log.warn('[OplogInit] No se pudo descargar OpLog remoto:', err.message)
      }
    } else {
      oplogLogInfo('[OplogInit] Drive not available, skipping remote download')
    }

    if (!this.localDoc) {
      oplogLogInfo('[OplogInit] No localDoc yet, cleaning stale binary and bootstrapping...')
      // Limpiar binario stale (vacío/corrupto) antes de bootstrappear
      await oplogStateService.deleteOplogBinary()

      // First time ever: bootstrap from current DB state
      try {
        oplogLogInfo('[OplogInit] Performing full migration from current DB...')
        const source = await oplogMigrationService.performFullMigration(deviceId)
        oplogLogInfo(`[OplogInit] Migration source: ${source}`)
        const binary = await oplogStateService.readOplogBinary()
        oplogLogInfo(`[OplogInit] Post-migration binary: ${binary ? binary.length + ' bytes' : 'null'}`)
        if (binary) {
          this.localDoc = load<OplogDocument>(binary)
        }
        if (this.localDoc) {
          this.currentSeq = (this.localDoc.ops ?? []).reduce((max, e) => Math.max(max, e.seq ?? 0), 0)
          const opsCount = this.localDoc.ops?.length ?? 0
          oplogLogInfo(`[OplogInit] Bootstrap complete: ${opsCount} ops, currentSeq=${this.currentSeq}`)
          if (opsCount > 0) {
            // NO poblar pendingEvents con los ops de bootstrap.
            // Si lo hiciéramos, push() subiría el estado local (posiblemente
            // incompleto) a Drive, sobrescribiendo los datos de la otra PC.
            // En su lugar, los nuevos eventos se agregarán a pendingEvents
            // cuando el middleware los capture tras el bootstrap.
            await oplogStateService.writeReplayState({
              lastAppliedIndex: opsCount - 1,
              lastAppliedEventId: this.localDoc.ops![opsCount - 1].id,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })
          }
        }
      } catch (err: any) {
        oplogLogWarn('[OplogInit] Bootstrap failed, creating empty document', { error: err.message, stack: err.stack })
        log.warn('[OplogInit] Bootstrap failed, creating empty document:', err.message)
      }

      if (!this.localDoc) {
        oplogLogInfo('[OplogInit] Creating empty document')
        this.localDoc = from<OplogDocument>({
          schemaVersion: 1,
          schemaHash: computeSchemaHash(),
          createdAt: Date.now(),
          ops: [],
        })
        await this.persistLocal()
        oplogLogInfo('[OplogInit] Empty document created and persisted')
      }
    }

    await this.backfillChecksums()

    oplogLogInfo(`[OplogInit] Final state: localDoc=${!!this.localDoc}, ops=${this.localDoc?.ops?.length ?? 0}, pendingEvents=${this.pendingEvents.length}`)
    await oplogStateService.writeConfig(this.config)
    oplogLogInfo('[OplogInit] init() complete')
  }

  private async backfillChecksums(): Promise<void> {
    if (!this.localDoc) return
    const ops = this.localDoc.ops ?? []
    const mediaRoot = getMediaDir()
    const updates = new Map<number, Partial<Pick<OplogEvent, 'checksum' | 'thumbnailChecksum' | 'fallbackChecksum'>>>()

    const tryFillChecksum = async (
      opIndex: number,
      op: OplogEvent,
      field: 'checksum' | 'thumbnailChecksum' | 'fallbackChecksum',
      dataPath: string | undefined,
      blobPath: string | undefined
    ) => {
      if (op[field]) return
      const relativePath = dataPath || blobPath
      if (!relativePath) return

      const cached = this.checksumCache.get(relativePath)
      if (cached) {
        const existing = updates.get(opIndex) ?? {}
        existing[field] = cached
        updates.set(opIndex, existing)
        return
      }

      const fullPath = path.join(mediaRoot, relativePath)
      if (await fs.pathExists(fullPath)) {
        const checksum = await oplogBlobService.computeChecksum(fullPath)
        this.checksumCache.set(relativePath, checksum)
        const existing = updates.get(opIndex) ?? {}
        existing[field] = checksum
        updates.set(opIndex, existing)
      }
    }

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      if (op.entityType !== 'media' && op.entityType !== 'font') continue
      await tryFillChecksum(i, op, 'checksum', op.data?.filePath as string | undefined, op.blobPath)
      if (op.entityType === 'media') {
        await tryFillChecksum(i, op, 'thumbnailChecksum', op.data?.thumbnail as string | undefined, op.thumbnailBlobPath)
        await tryFillChecksum(i, op, 'fallbackChecksum', op.data?.fallback as string | undefined, op.fallbackBlobPath)
      }
    }

    const opsBackfilled = updates.size
    if (opsBackfilled === 0) {
      oplogLogInfo('[Backfill] No checksums to backfill')
      return
    }

    this.localDoc = change(this.localDoc, 'backfill-checksums', (d) => {
      for (const [index, checksumUpdate] of updates) {
        const target = d.ops[index]
        if (!target) continue
        if (checksumUpdate.checksum) target.checksum = checksumUpdate.checksum
        if (checksumUpdate.thumbnailChecksum) target.thumbnailChecksum = checksumUpdate.thumbnailChecksum
        if (checksumUpdate.fallbackChecksum) target.fallbackChecksum = checksumUpdate.fallbackChecksum
      }
    })

    await this.persistLocal()
    oplogLogInfo(`[Backfill] Checksums backfilled for ${opsBackfilled} ops`)
    log.warn(`[OplogBackfill] Checksums backfilled for ${opsBackfilled} ops`)
  }

  async ensureInitialized(): Promise<boolean> {
    if (this.localDoc) return true

    const existingConfig = await oplogStateService.readConfig()
    if (existingConfig?.deviceId) {
      await this.init(existingConfig.deviceId)
      return true
    }

    const appInstanceId = await readJsonSafe<string>(getAppInstanceIdFilePath())
    if (appInstanceId) {
      await this.init(appInstanceId)
      return true
    }

    const hostname = os.hostname()
    const deviceId = `device-${hostname}-${Date.now().toString(36)}`
    await this.init(deviceId)
    return true
  }

  async appendEvent(input: {
    entityType: EntityType
    entityId: string
    op: 'upsert' | 'delete'
    data?: Record<string, unknown>
    checksum?: string
    thumbnailChecksum?: string
    fallbackChecksum?: string
    blobSize?: number
    blobMimeType?: string
    blobPath?: string
    thumbnailBlobPath?: string
    fallbackBlobPath?: string
  }): Promise<void> {
    if (!this.localDoc) return

    this.currentSeq++
    const event: OplogEvent = {
      id: randomUUID(),
      seq: this.currentSeq,
      deviceId: this.config!.deviceId,
      timestamp: Date.now(),
      entityType: input.entityType,
      entityId: input.entityId,
      op: input.op,
    }
    if (input.data !== undefined) event.data = input.data
    if (input.checksum !== undefined) event.checksum = input.checksum
    if (input.thumbnailChecksum !== undefined) event.thumbnailChecksum = input.thumbnailChecksum
    if (input.fallbackChecksum !== undefined) event.fallbackChecksum = input.fallbackChecksum
    if (input.blobSize !== undefined) event.blobSize = input.blobSize
    if (input.blobMimeType !== undefined) event.blobMimeType = input.blobMimeType
    if (input.blobPath !== undefined) event.blobPath = input.blobPath
    if (input.thumbnailBlobPath !== undefined) event.thumbnailBlobPath = input.thumbnailBlobPath
    if (input.fallbackBlobPath !== undefined) event.fallbackBlobPath = input.fallbackBlobPath

    if (input.entityType === 'media') {
      const mediaRoot = getMediaDir()

      const resolvePath = (field: string | undefined, fallbackField: string | undefined) => {
        if (typeof field === 'string' && field.trim()) return field
        if (typeof fallbackField === 'string' && fallbackField.trim()) return fallbackField
        return undefined
      }

      const maybeComputeChecksum = async (
        fieldPath: string | undefined,
        existingChecksum: string | undefined,
        checksumSetter: (value: string) => void
      ) => {
        if (existingChecksum || !fieldPath) return
        const fullPath = path.join(mediaRoot, fieldPath)
        if (!await fs.pathExists(fullPath)) return
        checksumSetter(await oplogBlobService.computeChecksum(fullPath))
      }

      const filePath = resolvePath(input.data?.filePath as string | undefined, input.blobPath)
      if (filePath && event.blobPath === undefined) event.blobPath = filePath
      await maybeComputeChecksum(filePath, event.checksum, (value) => { event.checksum = value })

      const thumbnailPath = resolvePath(input.data?.thumbnail as string | undefined, input.thumbnailBlobPath)
      if (thumbnailPath && event.thumbnailBlobPath === undefined) event.thumbnailBlobPath = thumbnailPath
      await maybeComputeChecksum(thumbnailPath, event.thumbnailChecksum, (value) => { event.thumbnailChecksum = value })

      const fallbackPath = resolvePath(input.data?.fallback as string | undefined, input.fallbackBlobPath)
      if (fallbackPath && event.fallbackBlobPath === undefined) event.fallbackBlobPath = fallbackPath
      await maybeComputeChecksum(fallbackPath, event.fallbackChecksum, (value) => { event.fallbackChecksum = value })
    }

    this.pendingEvents.push(event)

    this.localDoc = change(this.localDoc, `append:${event.entityType}:${event.entityId}`, (d) => {
      d.ops.push(event)
    })

    // La respuesta al frontend no espera la escritura a disco: el doc ya está
    // actualizado en memoria (que es lo que usan push()/syncCycle()). El binario
    // se persiste en segundo plano de forma coalescida.
    this.schedulePersist()

    this.onAppendEventCallback?.()
  }

  private schedulePersist(): void {
    this.persistDirty = true
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.drainPersist()
    }, PERSIST_DEBOUNCE_MS)
  }

  private drainPersist(): Promise<void> {
    if (this.persistPromise) return this.persistPromise
    this.persistPromise = (async () => {
      try {
        while (this.persistDirty) {
          this.persistDirty = false
          if (!this.localDoc) return
          const binary = save(this.localDoc)
          await oplogStateService.writeOplogBinary(binary)
        }
      } finally {
        this.persistPromise = null
      }
    })()
    return this.persistPromise
  }

  // Fuerza la escritura inmediata del oplog pendiente (usado en el cierre de la app
  // para garantizar durabilidad de los últimos eventos aún no volcados a disco).
  async flushPersist(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.persistDirty = true
    await this.drainPersist()
    if (this.persistDirty) await this.drainPersist()
  }

  private async persistLocal(): Promise<void> {
    if (this.localDoc) {
      const binary = save(this.localDoc)
      await oplogStateService.writeOplogBinary(binary)
    }
  }

  async pull(): Promise<{ newEventsCount: number; remoteGeneration: number }> {
    oplogLogInfo('[Pull] Starting pull()')
    if (!this.config) {
      oplogLogInfo('[Pull] Config not set, calling ensureInitialized()')
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    const driveAvailable = await oplogDriveService.isAvailable()
    oplogLogInfo(`[Pull] Drive isAvailable: ${driveAvailable}`)
    if (!driveAvailable) {
      oplogLogInfo('[Pull] Drive not connected, skipping pull')
      this.emitProgress('pull', 100, 'Drive no conectado')
      return { newEventsCount: 0, remoteGeneration: 0 }
    }

    this.emitProgress('pull', 5, 'Descargando OpLog remoto...')
    oplogLogInfo('[Pull] Attempting downloadOplog()...')
    const remote = await oplogDriveService.downloadOplog()
    oplogLogInfo(`[Pull] downloadOplog result: ${remote ? 'found (' + remote.data.length + ' bytes, gen=' + remote.generation + ')' : 'null (no remote oplog)'}`)

    if (!remote) {
      oplogLogInfo('[Pull] No remote OpLog found')
      this.emitProgress('pull', 100, 'No hay OpLog remoto')
      return { newEventsCount: 0, remoteGeneration: 0 }
    }

    this.emitProgress('pull', 30, 'Mergeando cambios remotos...')
    const remoteDoc = load<OplogDocument>(remote.data)
    oplogLogInfo(`[Pull] Remote doc loaded: ${remoteDoc.ops?.length ?? 0} ops`)

    if (!this.localDoc) {
      oplogLogInfo('[Pull] No local doc, adopting remote as local')
      this.localDoc = remoteDoc
      await this.persistLocal()
      this.emitProgress('pull', 100, `OpLog remoto recibido (${remoteDoc.ops?.length ?? 0} eventos)`)
      return { newEventsCount: 0, remoteGeneration: remote.generation }
    }

    const localIds = new Set(this.localDoc.ops?.map(o => o.id) ?? [])
    oplogLogInfo(`[Pull] Local doc has ${localIds.size} ops, cloning and merging...`)
    const localClone = clone(this.localDoc)
    const merged = merge(localClone, remoteDoc)

    this.localDoc = merged
    await this.persistLocal()

    const newEvents = (merged.ops ?? []).filter(o => !localIds.has(o.id))
    oplogLogInfo(`[Pull] New events after merge: ${newEvents.length}`)

    const mergedMediaOps = (merged.ops ?? []).filter(o => o.entityType === 'media')
    const mergedMediaWithThumbnail = mergedMediaOps.filter(o => !!o.thumbnailChecksum)
    oplogLogInfo(`[Pull-DIAG] Merged doc: ${mergedMediaOps.length} media ops, ${mergedMediaWithThumbnail.length} have thumbnailChecksum`)
    if (mergedMediaWithThumbnail.length < mergedMediaOps.length) {
      oplogLogWarn(`[Pull-DIAG] ${mergedMediaOps.length - mergedMediaWithThumbnail.length} media ops MISSING thumbnailChecksum after merge!`)
    }

    if (newEvents.length > 0) {
      this.emitProgress('pull', 60, `Aplicando ${newEvents.length} eventos nuevos...`)
      oplogLogInfo(`[Pull] Applying ${newEvents.length} new events...`)
      let applyResult
      try {
        applyResult = await oplogReplayService.applyEvents(newEvents)
      } catch (applyErr: any) {
        oplogLogError(`[Pull] applyEvents CRASHED: ${applyErr.message}`, { stack: applyErr.stack })
        log.error(`[Pull] applyEvents CRASHED: ${applyErr.message}`)
        this.emitProgress('pull', 100, `Error: ${applyErr.message}`)
        return { newEventsCount: 0, remoteGeneration: remote.generation }
      }
      emitInvalidateQueries(newEvents)
      oplogLogInfo(`[Pull] Apply result: ${applyResult.applied} applied, ${applyResult.errors.length} errors, ${applyResult.blobOps.length} blobOps`)

      const thumbnailOps = applyResult.blobOps.filter((b: any) => b.path?.startsWith('thumbnails/'))
      oplogLogInfo(`[Pull] Blob ops: ${applyResult.blobOps.length} total, ${thumbnailOps.length} thumbnails, ${applyResult.blobOps.length - thumbnailOps.length} files`)

      if (applyResult.errors.length > 0) {
        oplogLogWarn(`[OplogPull] ${applyResult.errors.length} errores al aplicar ${newEvents.length} eventos remotos:`)
        log.warn(`[OplogPull] ${applyResult.errors.length} errores al aplicar ${newEvents.length} eventos remotos:`)
        for (const err of applyResult.errors.slice(0, 20)) {
          oplogLogWarn(`  ${err}`)
          log.warn(`  ${err}`)
        }
        if (applyResult.errors.length > 20) {
          oplogLogWarn(`  ... y ${applyResult.errors.length - 20} más`)
          log.warn(`  ... y ${applyResult.errors.length - 20} más`)
        }
      }

      const replayState = await oplogStateService.readReplayState()
      if (replayState) {
        replayState.lastAppliedIndex = (merged.ops?.length ?? 0) - 1
        replayState.lastAppliedEventId = newEvents[newEvents.length - 1]?.id ?? null
        replayState.appliedAt = new Date().toISOString()
        await oplogStateService.writeReplayState(replayState)
        oplogLogInfo('[Pull] Replay state updated')
      }

      if (applyResult.blobOps.length > 0) {
        oplogLogInfo(`[Pull] Processing ${applyResult.blobOps.length} blob ops...`)
        this.emitProgress('pull', 80, `Sincronizando ${applyResult.blobOps.length} blobs...`)
        try {
          const blobResult = await oplogBlobService.processBlobOps(applyResult.blobOps)
          oplogLogInfo(`[Pull] Blob ops processed: ${blobResult.downloaded} downloaded, ${blobResult.uploaded} uploaded`)
        } catch (blobErr: any) {
          oplogLogError(`[Pull] processBlobOps CRASHED: ${blobErr.message}`, { stack: blobErr.stack })
          log.error(`[Pull] processBlobOps CRASHED: ${blobErr.message}`)
        }
      }

      this.emitProgress('pull', 100, `${newEvents.length} eventos aplicados`)
      oplogLogInfo('[Pull] Pull complete')
      return { newEventsCount: newEvents.length, remoteGeneration: remote.generation }
    }

    oplogLogInfo('[Pull] No new events to apply — but checking if merged doc gained checksums from remote...')
    this.emitProgress('pull', 100, 'Sin cambios nuevos')
    return { newEventsCount: 0, remoteGeneration: remote.generation }
  }

  async push(): Promise<{ pushed: number }> {
    oplogLogInfo('[Push] Starting push()')
    if (!this.config) {
      oplogLogInfo('[Push] Config not set, calling ensureInitialized()')
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    const driveAvailable = await oplogDriveService.isAvailable()
    oplogLogInfo(`[Push] Drive isAvailable: ${driveAvailable}`)
    if (!driveAvailable) {
      oplogLogInfo('[Push] Drive not connected, skipping push')
      this.emitProgress('push', 100, 'Drive no conectado')
      return { pushed: 0 }
    }

    const localPending = this.pendingEvents.length
    oplogLogInfo(`[Push] pendingEvents count: ${localPending}`)
    if (localPending === 0) {
      oplogLogInfo('[Push] No pending events to push')
      return { pushed: 0 }
    }

    const cfg = this.config!

    this.emitProgress('push', 10, 'Verificando schema remoto...')
    const remoteGen = cfg.lastRemoteGeneration ?? 0
    oplogLogInfo(`[Push] lastRemoteGeneration: ${remoteGen}`)

    this.emitProgress('push', 30, 'Subiendo OpLog a Drive...')
    oplogLogInfo('[Push] Attempting uploadOplog()...')

    try {
      const binary = save(this.localDoc!)
      oplogLogInfo(`[Push] Binary size: ${binary.length} bytes`)
      const result = await oplogDriveService.uploadOplog(
        binary,
        remoteGen > 0 ? remoteGen : undefined,
      )
      oplogLogInfo(`[Push] Upload result: fileId=${result.fileId}, generation=${result.generation}`)

      cfg.lastRemoteGeneration = result.generation
      cfg.lastPushAt = new Date().toISOString()
      cfg.lastSyncAt = new Date().toISOString()
      await oplogStateService.writeConfig(cfg)

      this.pendingEvents = []

      this.emitProgress('push', 100, `${localPending} eventos subidos`)
      oplogLogInfo(`[Push] Push complete: ${localPending} events uploaded`)
      return { pushed: localPending }
    } catch (err: any) {
      oplogLogWarn(`[Push] Upload error: ${err.message}`, { code: err.code, status: err.status })
      if (err instanceof OplogConcurrencyError) {
        oplogLogInfo(`[Push] Concurrency error detected, remoteGeneration=${err.remoteGeneration}`)
        this.emitProgress('push', 50, 'Conflicto detectado: re-mergeando...')
        cfg.lastRemoteGeneration = err.remoteGeneration
        await oplogStateService.writeConfig(cfg)

        oplogLogInfo('[Push] Pulling to resolve conflict...')
        const { newEventsCount, remoteGeneration } = await this.pull()
        oplogLogInfo(`[Push] After conflict pull: ${newEventsCount} new events, remoteGen=${remoteGeneration}`)

        if (this.pendingEvents.length > 0) {
          oplogLogInfo('[Push] Retrying push after conflict resolution...')
          return this.push()
        }

        oplogLogInfo('[Push] No pending events after conflict, returning 0')
        return { pushed: 0 }
      }
      oplogLogError(`[Push] Unhandled upload error: ${err.message}`, { stack: err.stack })
      throw err
    }
  }

  async syncBlobs(): Promise<{ downloaded: number; uploaded: number; deleted: number }> {
    oplogLogInfo('[Blob] Starting syncBlobs()')
    if (!this.config) throw new Error('Oplog not initialized')

    const driveAvailable = await oplogDriveService.isAvailable()
    oplogLogInfo(`[Blob] Drive isAvailable: ${driveAvailable}`)
    if (!driveAvailable) {
      oplogLogInfo('[Blob] Drive not connected, skipping blob sync')
      this.emitProgress('blob', 100, 'Drive no conectado')
      return { downloaded: 0, uploaded: 0, deleted: 0 }
    }

    this.emitProgress('blob', 5, 'Migrando blobs de medios legacy...')
    oplogLogInfo('[Blob] Migrating legacy media blobs...')
    const migratedBlobs = await oplogMigrationService.migrateExistingMediaBlobs()
    oplogLogInfo(`[Blob] Migrated blobs: ${migratedBlobs}`)
    if (migratedBlobs > 0) {
      log.warn(`[OplogBlob] ${migratedBlobs} blobs migrados del manifest legacy`)
    }

    this.emitProgress('blob', 10, 'Escaneando blobs activos...')
    const ops = this.localDoc?.ops ?? []
    const activeChecksums = new Set<string>()
    const opsLen = ops.length
    oplogLogInfo(`[Blob] Total ops to scan: ${opsLen}`)

    for (let idx = 0; idx < opsLen; idx++) {
      const op = ops[idx]
      if (op.op === 'upsert' && (op.entityType === 'media' || op.entityType === 'font')) {
        if (op.checksum) activeChecksums.add(op.checksum)
        if (op.entityType === 'media') {
          if (op.thumbnailChecksum) activeChecksums.add(op.thumbnailChecksum)
          if (op.fallbackChecksum) activeChecksums.add(op.fallbackChecksum)
        }
      }
      if (idx % 500 === 0 && idx > 0) {
        this.emitProgress('blob', 12, `Escaneando blobs activos... ${idx}/${opsLen}`)
      }
    }
    oplogLogInfo(`[Blob] Active checksums: ${activeChecksums.size}`)

    const allMediaOps = ops.filter(o => o.entityType === 'media' && o.op === 'upsert')
    const mediaWithThumbnailChecksum = allMediaOps.filter(o => !!o.thumbnailChecksum)
    const mediaWithFilePath = allMediaOps.filter(o => !o.thumbnailChecksum && (o.data?.thumbnail || o.thumbnailBlobPath))
    oplogLogInfo(`[Blob-DIAG] Media upsert ops: ${allMediaOps.length}, with thumbnailChecksum: ${mediaWithThumbnailChecksum.length}, with path but no checksum: ${mediaWithFilePath.length}`)

    const toDownload: Array<{ checksum: string; path: string }> = []
    const toUpload: Array<{ checksum: string; localPath: string }> = []
    const seenChecksums = new Set<string>()

    const mediaRoot = getMediaDir()
    oplogLogInfo(`[Blob] Media root: ${mediaRoot}`)

    const resolveRelativePath = (dataPath: string | undefined, blobPath: string | undefined) => dataPath || blobPath || undefined

    const enqueueBlob = async (checksum: string | undefined, relativePath: string | undefined) => {
      if (!checksum || !relativePath || seenChecksums.has(checksum)) return
      seenChecksums.add(checksum)
      const localPath = path.join(mediaRoot, relativePath)
      if (await fs.pathExists(localPath)) {
        toUpload.push({ checksum, localPath })
      } else {
        toDownload.push({ checksum, path: relativePath })
      }
    }

    for (let idx = 0; idx < opsLen; idx++) {
      const op = ops[idx]
      if (op.op === 'upsert') {
        await enqueueBlob(op.checksum, resolveRelativePath(op.data?.filePath as string | undefined, op.blobPath))
        if (op.entityType === 'media') {
          await enqueueBlob(op.thumbnailChecksum, resolveRelativePath(op.data?.thumbnail as string | undefined, op.thumbnailBlobPath))
          await enqueueBlob(op.fallbackChecksum, resolveRelativePath(op.data?.fallback as string | undefined, op.fallbackBlobPath))
        }
      }
      if (idx % 500 === 0 && idx > 0) {
        this.emitProgress('blob', 20, `Verificando archivos locales... ${idx}/${opsLen}`)
      }
    }
    oplogLogInfo(`[Blob] To upload: ${toUpload.length}, To download: ${toDownload.length}`)

    if (!this.blobFallbackDone) {
      if (!this.localDoc) {
        oplogLogInfo('[Blob] No local doc, skipping fallback')
      } else {
        oplogLogInfo('[Blob] Running fallback checksum generation...')
        const fallbackLen = opsLen

        const blobFieldMap: Record<string, string> = {
          checksum: 'blobPath',
          thumbnailChecksum: 'thumbnailBlobPath',
          fallbackChecksum: 'fallbackBlobPath',
        }

        const fallbackUpdates = new Map<number, Record<string, string>>()
        let fbChecksumCount = 0
        let fbThumbnailChecksumCount = 0
        let fbFallbackChecksumCount = 0
        let fbCacheHitCount = 0
        let fbFileFoundCount = 0
        let fbFileMissingCount = 0
        let fbAlreadySeenCount = 0

        const enqueueFallback = async (
          idx: number,
          checksum: string | undefined,
          dataPath: string | undefined,
          blobPath: string | undefined,
          checksumField: 'checksum' | 'thumbnailChecksum' | 'fallbackChecksum'
        ) => {
          if (checksum) return
          const relPath = dataPath ?? blobPath
          if (!relPath) return

          const cached = this.checksumCache.get(relPath)
          if (cached) {
            if (seenChecksums.has(cached)) {
              fbAlreadySeenCount++
              return
            }
            fbCacheHitCount++
            seenChecksums.add(cached)
            activeChecksums.add(cached)

            if (!fallbackUpdates.has(idx)) fallbackUpdates.set(idx, {})
            fallbackUpdates.get(idx)![checksumField] = cached
            fallbackUpdates.get(idx)![blobFieldMap[checksumField]] = relPath

            const localPath = path.join(mediaRoot, relPath)
            if (await fs.pathExists(localPath)) {
              toUpload.push({ checksum: cached, localPath })
            } else {
              toDownload.push({ checksum: cached, path: relPath })
            }
            return
          }

          const localPath = path.join(mediaRoot, relPath)
          if (await fs.pathExists(localPath)) {
            fbFileFoundCount++
            const computed = await oplogBlobService.computeChecksum(localPath)
            if (seenChecksums.has(computed)) {
              fbAlreadySeenCount++
              return
            }
            seenChecksums.add(computed)
            this.checksumCache.set(relPath, computed)
            activeChecksums.add(computed)

            if (!fallbackUpdates.has(idx)) fallbackUpdates.set(idx, {})
            fallbackUpdates.get(idx)![checksumField] = computed
            fallbackUpdates.get(idx)![blobFieldMap[checksumField]] = relPath

            toUpload.push({ checksum: computed, localPath })
          } else {
            fbFileMissingCount++
          }
        }

        for (let idx = 0; idx < fallbackLen; idx++) {
          const op = ops[idx]
          if (op.op !== 'upsert') continue
          const isBlobType = op.entityType === 'media' || op.entityType === 'font'
          if (!isBlobType) continue

          const needsMain = op.data?.filePath && !op.checksum
          if (needsMain) fbChecksumCount++
          await enqueueFallback(idx, op.checksum, op.data?.filePath as string | undefined, op.blobPath, 'checksum')
          if (op.entityType === 'media') {
            if (op.data?.thumbnail && !op.thumbnailChecksum) fbThumbnailChecksumCount++
            if (op.data?.fallback && !op.fallbackChecksum) fbFallbackChecksumCount++
            await enqueueFallback(idx, op.thumbnailChecksum, op.data?.thumbnail as string | undefined, op.thumbnailBlobPath, 'thumbnailChecksum')
            await enqueueFallback(idx, op.fallbackChecksum, op.data?.fallback as string | undefined, op.fallbackBlobPath, 'fallbackChecksum')
          }

          if (idx % 200 === 0 && idx > 0) {
            this.emitProgress('blob', 35, `Fallback: generando checksums... ${idx}/${fallbackLen}`)
          }
        }

        oplogLogInfo(`[Blob-DIAG] Fallback: ${fbChecksumCount} main, ${fbThumbnailChecksumCount} thumbnail, ${fbFallbackChecksumCount} fallback. Cache hits: ${fbCacheHitCount}, File found: ${fbFileFoundCount}, File missing: ${fbFileMissingCount}, Already seen: ${fbAlreadySeenCount}`)

        if (fallbackUpdates.size > 0) {
          this.localDoc = change(this.localDoc!, 'fallback-backfill', (d) => {
            for (const [idx, update] of fallbackUpdates) {
              const target = d.ops[idx]
              if (!target) continue
              if (update.checksum) target.checksum = update.checksum
              if (update.blobPath) target.blobPath = update.blobPath
              if (update.thumbnailChecksum) target.thumbnailChecksum = update.thumbnailChecksum
              if (update.thumbnailBlobPath) target.thumbnailBlobPath = update.thumbnailBlobPath
              if (update.fallbackChecksum) target.fallbackChecksum = update.fallbackChecksum
              if (update.fallbackBlobPath) target.fallbackBlobPath = update.fallbackBlobPath
            }
          })
          await this.persistLocal()
          oplogLogInfo(`[Blob] Fallback checksums persisted to ${fallbackUpdates.size} events`)
        }

        this.blobFallbackDone = true
        oplogLogInfo(`[Blob] Fallback complete. Total to upload: ${toUpload.length}, to download: ${toDownload.length}`)
      }
    }

    // Regenerar thumbnails y fallbacks desde source files (cada ciclo)
    const regenOps = this.localDoc?.ops ?? []
    const generatedThumbnails = new Map<number, {
      checksum: string
      blobPath: string
      fallbackChecksum?: string
      fallbackBlobPath?: string
    }>()
    let thumbRegenerated = 0
    let fallbackRegenerated = 0

    for (let idx = 0; idx < regenOps.length; idx++) {
      const op = regenOps[idx]
      if (op.op !== 'upsert' || op.entityType !== 'media') continue
      if (op.thumbnailChecksum) continue
      if (op.data?.thumbnail || op.thumbnailBlobPath) continue

      const filePath = (op.data?.filePath as string) ?? op.blobPath
      if (!filePath) continue

      const sourceFullPath = path.join(mediaRoot, filePath)
      if (!await fs.pathExists(sourceFullPath)) continue

      const ext = path.extname(filePath).toLowerCase()
      const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'].includes(ext)
      const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)
      if (!isImage && !isVideo) continue

      const originalName = path.basename(filePath, ext)
      const hash = randomBytes(8).toString('hex')
      const thumbDir = path.join(mediaRoot, 'thumbnails')

      await fs.ensureDir(thumbDir)

      const thumbFileName = buildThumbnailFileName(originalName, hash)
      const thumbFullPath = path.join(thumbDir, thumbFileName)

      try {
        if (isImage) {
          await generateImageThumbnail(sourceFullPath, thumbFullPath)
        } else {
          await generateVideoThumbnail(sourceFullPath, thumbFullPath)
        }
      } catch (err: any) {
        oplogLogWarn(`[Blob] Regenerate thumb failed for ${filePath}: ${err.message}`)
        continue
      }

      const thumbChecksum = await oplogBlobService.computeChecksum(thumbFullPath)
      const thumbRelPath = `thumbnails/${thumbFileName}`
      const entry: {
        checksum: string
        blobPath: string
        fallbackChecksum?: string
        fallbackBlobPath?: string
      } = { checksum: thumbChecksum, blobPath: thumbRelPath }

      if (!seenChecksums.has(thumbChecksum)) {
        seenChecksums.add(thumbChecksum)
        activeChecksums.add(thumbChecksum)
        toUpload.push({ checksum: thumbChecksum, localPath: thumbFullPath })
        thumbRegenerated++
      }

      if (isVideo) {
        const fallbackFileName = buildFallbackFileName(originalName, hash)
        const fallbackFullPath = path.join(thumbDir, fallbackFileName)
        try {
          await generateVideoFallback(sourceFullPath, fallbackFullPath)
        } catch (err: any) {
          oplogLogWarn(`[Blob] Regenerate fallback failed for ${filePath}: ${err.message}`)
        }
        if (await fs.pathExists(fallbackFullPath)) {
          const fallbackChecksum = await oplogBlobService.computeChecksum(fallbackFullPath)
          const fallbackRelPath = `thumbnails/${fallbackFileName}`
          if (!seenChecksums.has(fallbackChecksum)) {
            seenChecksums.add(fallbackChecksum)
            activeChecksums.add(fallbackChecksum)
            toUpload.push({ checksum: fallbackChecksum, localPath: fallbackFullPath })
            fallbackRegenerated++
          }
          entry.fallbackChecksum = fallbackChecksum
          entry.fallbackBlobPath = fallbackRelPath
        }
      }

      generatedThumbnails.set(idx, entry)
    }

    if (generatedThumbnails.size > 0) {
      this.localDoc = change(this.localDoc!, 'regenerate-media-assets', (d) => {
        for (const [idx, update] of generatedThumbnails) {
          const target = d.ops[idx]
          if (!target) continue
          target.thumbnailChecksum = update.checksum
          target.thumbnailBlobPath = update.blobPath
          if (update.fallbackChecksum) target.fallbackChecksum = update.fallbackChecksum
          if (update.fallbackBlobPath) target.fallbackBlobPath = update.fallbackBlobPath
          if (target.data) {
            target.data.thumbnail = update.blobPath
            if (update.fallbackBlobPath) target.data.fallback = update.fallbackBlobPath
          }
        }
      })
      await this.persistLocal()
      oplogLogInfo(`[Blob] Regenerated ${thumbRegenerated} thumbnails and ${fallbackRegenerated} fallbacks from source files`)
    }

    const blobOps: Array<any> = [
      ...toUpload.map(b => ({ type: 'upload' as const, checksum: b.checksum, localPath: b.localPath })),
      ...toDownload.map(b => ({ type: 'download' as const, checksum: b.checksum, path: b.path })),
    ]
    const totalBlobs = blobOps.length
    oplogLogInfo(`[Blob] Total blob ops: ${totalBlobs}`)
    this.emitProgress('blob', 50, `Procesando 0/${totalBlobs} blobs...`)
    let blobResult = { downloaded: 0, uploaded: 0, deleted: 0, moved: 0 }
    try {
      blobResult = await oplogBlobService.processBlobOps(
        blobOps,
        (current, total) => {
          const pct = Math.min(50 + Math.round((current / total) * 40), 89)
          this.emitProgress('blob', pct, `Procesando ${current}/${total} blobs...`)
        },
      )
    } catch (blobErr: any) {
      oplogLogError(`[Blob] processBlobOps CRASHED: ${blobErr.message}`, { stack: blobErr.stack })
      log.error(`[Blob] processBlobOps CRASHED: ${blobErr.message}`)
    }
    oplogLogInfo(`[Blob] Process result: ${blobResult.downloaded} downloaded, ${blobResult.uploaded} uploaded`)

    this.emitProgress('blob', 90, 'Limpiando blobs huérfanos...')
    const gcDeleted = await oplogBlobService.garbageCollectBlobs(activeChecksums)
    oplogLogInfo(`[Blob] GC deleted: ${gcDeleted}`)

    // Podar eventos del OpLog para media soft-deleted sin blob data
    if (this.localDoc) {
      const pruneOps = this.localDoc.ops
      const prunedEntityIds = new Set<string>()
      for (const op of pruneOps) {
        if (op.op !== 'upsert' || op.entityType !== 'media') continue
        const deletedAt = (op.data as Record<string, unknown> | undefined)?.deletedAt
        const hasBlobData = !!(op.checksum || op.blobPath || op.thumbnailChecksum || op.thumbnailBlobPath || op.fallbackChecksum || op.fallbackBlobPath)
        if (deletedAt && !hasBlobData) {
          prunedEntityIds.add(op.entityId)
        }
      }
      if (prunedEntityIds.size > 0) {
        let removedCount = 0
        this.localDoc = change(this.localDoc!, 'prune-deleted-media', (d) => {
          for (let i = d.ops.length - 1; i >= 0; i--) {
            const op = d.ops[i]
            if (op.entityType === 'media' && prunedEntityIds.has(op.entityId)) {
              d.ops.splice(i, 1)
              removedCount++
            }
          }
        })
        if (removedCount > 0) {
          await this.persistLocal()
          oplogLogInfo(`[Blob] Pruned ${removedCount} events for ${prunedEntityIds.size} soft-deleted media records`)
        }
      }
    }

    // Limpiar thumbnails huérfanos (sin referencia en DB ni en eventos)
    const thumbDir = path.join(mediaRoot, 'thumbnails')
    if (await fs.pathExists(thumbDir)) {
      const validThumbs = new Set<string>()

      // thumbnails referenciados por eventos activos (post-pruning)
      const liveOps = this.localDoc?.ops ?? []
      for (const op of liveOps) {
        if (op.op !== 'upsert' || op.entityType !== 'media') continue
        if (op.data?.thumbnail) validThumbs.add(op.data.thumbnail as string)
        if (op.data?.fallback) validThumbs.add(op.data.fallback as string)
        if (op.thumbnailBlobPath) validThumbs.add(op.thumbnailBlobPath)
        if (op.fallbackBlobPath) validThumbs.add(op.fallbackBlobPath)
      }

      // thumbnails/fallbacks referenciados por registros activos en DB
      try {
        const prisma = getPrisma()
        const dbMediaThumbs = await prisma.media.findMany({
          where: { deletedAt: null, OR: [{ thumbnail: { not: null } }, { fallback: { not: null } }] },
          select: { thumbnail: true, fallback: true },
        })
        for (const m of dbMediaThumbs) {
          if (m.thumbnail) validThumbs.add(m.thumbnail)
          if (m.fallback) validThumbs.add(m.fallback)
        }
      } catch { /* DB no disponible */ }

      // Escanear directorio y eliminar huérfanos
      const thumbFiles = await fs.readdir(thumbDir)
      let orphanCount = 0
      for (const file of thumbFiles) {
        const fullPath = path.join(thumbDir, file)
        const stat = await fs.stat(fullPath).catch(() => null)
        if (!stat || !stat.isFile()) continue

        const relPath = `thumbnails/${file}`
        if (!validThumbs.has(relPath)) {
          await fs.remove(fullPath)
          orphanCount++
          oplogLogInfo(`[Blob] Eliminado thumbnail huérfano local: ${relPath}`)
        }
      }
      if (orphanCount > 0) {
        oplogLogInfo(`[Blob] Eliminados ${orphanCount} thumbnails huérfanos locales`)
      }
    }

    // Invalidar queries para refrescar UI despues de sync
    emitInvalidateQueries(ops)

    this.emitProgress('blob', 100, `${blobResult.downloaded} descargados, ${gcDeleted} GC`)
    oplogLogInfo('[Blob] syncBlobs() complete')
    return {
      downloaded: blobResult.downloaded,
      uploaded: blobResult.uploaded,
      deleted: gcDeleted,
    }
  }

  private async runPurge(): Promise<void> {
    if (!this.config) return
    if (!oplogPurgeService.isPurgeDue(this.config)) {
      oplogLogInfo('[Purge] Not due yet, skipping')
      return
    }

    oplogLogInfo('[Purge] Starting soft-delete purge')
    try {
      const result = await oplogPurgeService.purgeSoftDeleted(this.config)
      this.config.lastPurgeAt = new Date().toISOString()
      await oplogStateService.writeConfig(this.config)

      if (result.totalPurged > 0) {
        oplogLogInfo(`[Purge] Completed: ${JSON.stringify(result.purged)} (${result.totalPurged} total)`)
        this.emitProgress('purge', 100, `Purgados ${result.totalPurged} registros`)
      } else {
        oplogLogInfo('[Purge] No records to purge')
      }
    } catch (err: any) {
      oplogLogWarn(`[Purge] Error: ${err.message}`)
    }
  }

  private syncing = false

  async syncCycle(): Promise<SyncCycleResult> {
    if (this.syncing) {
      oplogLogInfo('[SyncCycle] Already running — skipping concurrent call')
      return { pulled: 0, pushed: 0, blobsDownloaded: 0, blobsUploaded: 0, errors: [] }
    }
    this.syncing = true

    oplogLogInfo('[SyncCycle] Starting syncCycle()')
    if (!this.config) {
      oplogLogInfo('[SyncCycle] Config not set, calling ensureInitialized()')
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    oplogLogInfo(`[SyncCycle] Config: deviceId=${this.config!.deviceId}, pendingEvents=${this.pendingEvents.length}, lastRemoteGeneration=${this.config!.lastRemoteGeneration}`)

    const result: SyncCycleResult = { pulled: 0, pushed: 0, blobsDownloaded: 0, blobsUploaded: 0, errors: [] }

    try {
      oplogLogInfo('[SyncCycle] Phase 1/4: Pull')
      const pullResult = await this.runMappedPhase('pull', '1/4 Pull', 0, 28, () => this.pull())
      result.pulled = pullResult.newEventsCount
      oplogLogInfo(`[SyncCycle] Pull result: ${pullResult.newEventsCount} new events, remoteGen=${pullResult.remoteGeneration}`)

      oplogLogInfo('[SyncCycle] Phase 2/4: Blobs')
      const blobResult = await this.runMappedPhase('blob', '2/4 Blobs', 28, 56, () => this.syncBlobs())
      result.blobsDownloaded = blobResult.downloaded
      result.blobsUploaded = blobResult.uploaded
      oplogLogInfo(`[SyncCycle] Blob result: ${blobResult.downloaded} downloaded, ${blobResult.uploaded} uploaded, ${blobResult.deleted} deleted`)

      oplogLogInfo('[SyncCycle] Phase 3/4: Push')
      const pushResult = await this.runMappedPhase('push', '3/4 Push', 66, 88, () => this.push())
      result.blobsDownloaded = blobResult.downloaded
      result.blobsUploaded = blobResult.uploaded
      oplogLogInfo(`[SyncCycle] Push result: pushed=${pushResult.pushed}`)

      oplogLogInfo('[SyncCycle] Phase 4/4: Purge')
      await this.runMappedPhase('purge', '4/4 Purge', 88, 100, () => this.runPurge())
    } catch (err: any) {
      oplogLogError(`[SyncCycle] Error during cycle: ${err.message}`, { stack: err.stack })
      result.errors.push(err.message)
      this.emitProgress('idle', 0, `Error: ${err.message}`)
    } finally {
      this.syncing = false
    }

    this.config!.lastSyncAt = new Date().toISOString()
    await oplogStateService.writeConfig(this.config!)
    oplogLogInfo(`[SyncCycle] Cycle complete: ${JSON.stringify(result)}`)

    return result
  }
}

export const oplogService = new OplogService()
