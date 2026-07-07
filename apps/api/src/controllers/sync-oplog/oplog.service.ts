import {
  from, change, merge, clone, save, load,
  type Doc,
} from '@automerge/automerge'
import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import { getPrisma } from '../../prisma'
import { oplogStateService } from './oplog-state.service'
import { oplogDriveService, OplogConcurrencyError } from './oplog-drive.service'
import { oplogReplayService } from './oplog-replay.service'
import { oplogBlobService } from './oplog-blob.service'
import { oplogMigrationService } from './oplog-migration.service'
import { computeSchemaHash } from './oplog-utils'
import { readJsonSafe } from '../sync/sync.utils'
import { getAppInstanceIdFilePath, getMediaDir } from '../sync/sync.config'
import log from 'electron-log'
import type {
  OplogDocument, OplogEvent, OplogConfig, EntityType,
  SyncCycleResult, SyncProgress,
} from './oplog.types'

export type SyncEventCallback = (progress: SyncProgress) => void

export class OplogService {
  private localDoc: Doc<OplogDocument> | null = null
  private currentSeq = 0
  private pendingEvents: OplogEvent[] = []
  private onProgress: SyncEventCallback | null = null
  private blobFallbackDone = false
  private checksumCache = new Map<string, string>()
  private onAppendEventCallback: (() => void) | null = null
  private config: OplogConfig | null = null

  get isInitialized(): boolean {
    return this.localDoc !== null
  }

  setOnProgress(cb: SyncEventCallback): void {
    this.onProgress = cb
  }

  setOnAppendEventCallback(cb: (() => void) | null): void {
    this.onAppendEventCallback = cb
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
    log.warn(`[DIAG-INIT] init() called deviceId=${deviceId}`)
    this.config = {
      deviceId,
      deviceName: os.hostname(),
      lastPushAt: null,
      lastPullAt: null,
      lastSyncAt: null,
      lastRemoteGeneration: null,
    }

    const existing = await oplogStateService.readOplogBinary()
    if (existing && existing.length > 0) {
      try {
        this.localDoc = load<OplogDocument>(existing)
      } catch {
        log.warn('[OplogInit] Local OpLog corrupto — bootstrapping desde DB local')
        this.localDoc = null
      }

      if (this.localDoc) {
        const ops = this.localDoc.ops ?? []
        if (ops.length > 0) {
          this.currentSeq = ops.reduce((max, e) => Math.max(max, e.seq ?? 0), 0)

          const replayState = await oplogStateService.readReplayState()
          if (replayState) {
            const newEvents = ops.slice(replayState.lastAppliedIndex === -1 ? 0 : replayState.lastAppliedIndex + 1)
            if (newEvents.length > 0) {
              this.emitProgress('pull', 0, `Aplicando ${newEvents.length} eventos pendientes...`)
              const result = await oplogReplayService.applyEvents(newEvents)
              replayState.lastAppliedIndex = ops.length - 1
              replayState.lastAppliedEventId = newEvents[newEvents.length - 1]?.id ?? null
              replayState.appliedAt = new Date().toISOString()
              await oplogStateService.writeReplayState(replayState)
            }
          } else {
            // No replay state — aplicar todos los eventos desde 0
            this.emitProgress('pull', 0, `Aplicando ${ops.length} eventos desde 0...`)
            const result = await oplogReplayService.applyEvents(ops)
            await oplogStateService.writeReplayState({
              lastAppliedIndex: ops.length - 1,
              lastAppliedEventId: ops[ops.length - 1]?.id ?? null,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })
          }

          await this.backfillChecksums()

          const savedConfig = await oplogStateService.readConfig()
          if (savedConfig) {
            this.config = { ...this.config, ...savedConfig }
          }

          // Poblar pendingEvents con todos los ops para que push() los suba a Drive
          this.pendingEvents = [...(this.localDoc.ops ?? [])]
          return
        }
        log.info('[OplogInit] Local OpLog vacío — bootstrapping desde DB local')
        this.localDoc = null
      }
    }

    // No local OpLog — intentar descargar desde Drive (PC secundaria virgen)
    if (await oplogDriveService.isAvailable()) {
      try {
        const remote = await oplogDriveService.downloadOplog()
        if (remote) {
          const remoteDoc = load<OplogDocument>(remote.data)
          const ops = remoteDoc.ops ?? []

          if (ops.length === 0) {
            // Remote OpLog is empty — ignore and bootstrap from local DB
            log.info('[OplogInit] Remote OpLog vacío — bootstrapping desde DB local')
          } else {
            this.emitProgress('pull', 10, 'OpLog remoto encontrado, descargando...')
            this.localDoc = remoteDoc
            this.currentSeq = ops.reduce((max, e) => Math.max(max, e.seq ?? 0), 0)
            await this.persistLocal()

            this.config.lastRemoteGeneration = remote.generation
            this.config.lastPullAt = new Date().toISOString()

            // Replicar todos los eventos a la DB local
            this.emitProgress('pull', 40, `Aplicando ${ops.length} eventos...`)
            const applyResult = await oplogReplayService.applyEvents(ops)
            this.emitProgress('pull', 90, `${applyResult.applied} eventos replicados`)

            if (applyResult.blobOps.length > 0) {
              this.emitProgress('blob', 50, `Sincronizando ${applyResult.blobOps.length} blobs...`)
              await oplogBlobService.processBlobOps(applyResult.blobOps)
            }

            await oplogStateService.writeReplayState({
              lastAppliedIndex: ops.length - 1,
              lastAppliedEventId: ops[ops.length - 1]?.id ?? null,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })

            this.emitProgress('pull', 100, 'OpLog remoto replicado a DB local')
          }
        }
      } catch (err: any) {
        log.warn('[OplogInit] No se pudo descargar OpLog remoto:', err.message)
      }
    }

    if (!this.localDoc) {
      // Limpiar binario stale (vacío/corrupto) antes de bootstrappear
      await oplogStateService.deleteOplogBinary()

      // First time ever: bootstrap from current DB state
      try {
        const source = await oplogMigrationService.performFullMigration(deviceId)
        this.localDoc = load<OplogDocument>((await oplogStateService.readOplogBinary())!)
        if (this.localDoc) {
          this.currentSeq = (this.localDoc.ops ?? []).reduce((max, e) => Math.max(max, e.seq ?? 0), 0)
          const opsCount = this.localDoc.ops?.length ?? 0
          if (opsCount > 0) {
            this.pendingEvents = [...this.localDoc.ops!]
            await oplogStateService.writeReplayState({
              lastAppliedIndex: opsCount - 1,
              lastAppliedEventId: this.localDoc.ops![opsCount - 1].id,
              snapshotAppliedAt: null,
              appliedAt: new Date().toISOString(),
            })
          }
        }
      } catch (err: any) {
        log.warn('[OplogInit] Bootstrap failed, creating empty document:', err.message)
      }

      if (!this.localDoc) {
        this.localDoc = from<OplogDocument>({
          schemaVersion: 1,
          schemaHash: computeSchemaHash(),
          createdAt: Date.now(),
          ops: [],
        })
        await this.persistLocal()
      }
    }

    await oplogStateService.writeConfig(this.config)
  }

  private async backfillChecksums(): Promise<void> {
    if (!this.localDoc) return
    const ops = this.localDoc.ops ?? []
    const mediaRoot = getMediaDir()
    const updates = new Map<number, string>()

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      if (op.checksum) continue
      if (op.entityType !== 'media' && op.entityType !== 'font') continue
      const filePath = (op.data?.filePath as string) ?? op.blobPath
      if (!filePath) continue

      const cached = this.checksumCache.get(filePath)
      if (cached) {
        updates.set(i, cached)
        continue
      }

      const fullPath = path.join(mediaRoot, filePath)
      if (await fs.pathExists(fullPath)) {
        const checksum = await oplogBlobService.computeChecksum(fullPath)
        this.checksumCache.set(filePath, checksum)
        updates.set(i, checksum)
      }
    }

    if (updates.size === 0) return

    this.localDoc = change(this.localDoc, 'backfill-checksums', (d) => {
      for (const [index, checksum] of updates) {
        d.ops[index].checksum = checksum
      }
    })

    await this.persistLocal()
    log.warn(`[OplogBackfill] Checksums backfilled for ${updates.size} ops`)
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
    blobSize?: number
    blobMimeType?: string
    blobPath?: string
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
    if (input.blobSize !== undefined) event.blobSize = input.blobSize
    if (input.blobMimeType !== undefined) event.blobMimeType = input.blobMimeType
    if (input.blobPath !== undefined) event.blobPath = input.blobPath

    this.pendingEvents.push(event)

    this.localDoc = change(this.localDoc, `append:${event.entityType}:${event.entityId}`, (d) => {
      d.ops.push(event)
    })

    await this.persistLocal()

    this.onAppendEventCallback?.()
  }

  private async persistLocal(): Promise<void> {
    if (this.localDoc) {
      const binary = save(this.localDoc)
      await oplogStateService.writeOplogBinary(binary)
    }
  }

  async pull(): Promise<{ newEventsCount: number; remoteGeneration: number }> {
    if (!this.config) {
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    if (!(await oplogDriveService.isAvailable())) {
      this.emitProgress('pull', 100, 'Drive no conectado')
      return { newEventsCount: 0, remoteGeneration: 0 }
    }

    this.emitProgress('pull', 5, 'Descargando OpLog remoto...')
    const remote = await oplogDriveService.downloadOplog()

    if (!remote) {
      this.emitProgress('pull', 100, 'No hay OpLog remoto')
      return { newEventsCount: 0, remoteGeneration: 0 }
    }

    this.emitProgress('pull', 30, 'Mergeando cambios remotos...')
    const remoteDoc = load<OplogDocument>(remote.data)

    if (!this.localDoc) {
      this.localDoc = remoteDoc
      await this.persistLocal()
      this.emitProgress('pull', 100, `OpLog remoto recibido (${remoteDoc.ops?.length ?? 0} eventos)`)
      return { newEventsCount: 0, remoteGeneration: remote.generation }
    }

    const localClone = clone(this.localDoc)
    const merged = merge(localClone, remoteDoc)

    const localIds = new Set(this.localDoc.ops?.map(o => o.id) ?? [])

    this.localDoc = merged
    await this.persistLocal()

    const newEvents = (merged.ops ?? []).filter(o => !localIds.has(o.id))
    if (newEvents.length > 0) {
      this.emitProgress('pull', 60, `Aplicando ${newEvents.length} eventos nuevos...`)
      const applyResult = await oplogReplayService.applyEvents(newEvents)

      const replayState = await oplogStateService.readReplayState()
      if (replayState) {
        replayState.lastAppliedIndex = (merged.ops?.length ?? 0) - 1
        replayState.lastAppliedEventId = newEvents[newEvents.length - 1]?.id ?? null
        replayState.appliedAt = new Date().toISOString()
        await oplogStateService.writeReplayState(replayState)
      }

      if (applyResult.blobOps.length > 0) {
        this.emitProgress('pull', 80, `Sincronizando ${applyResult.blobOps.length} blobs...`)
        await oplogBlobService.processBlobOps(applyResult.blobOps)
      }

      this.emitProgress('pull', 100, `${newEvents.length} eventos aplicados`)
      return { newEventsCount: newEvents.length, remoteGeneration: remote.generation }
    }

    this.emitProgress('pull', 100, 'Sin cambios nuevos')
    return { newEventsCount: 0, remoteGeneration: remote.generation }
  }

  async push(): Promise<{ pushed: number }> {
    if (!this.config) {
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    if (!(await oplogDriveService.isAvailable())) {
      this.emitProgress('push', 100, 'Drive no conectado')
      return { pushed: 0 }
    }

    const localPending = this.pendingEvents.length
    if (localPending === 0) {
      return { pushed: 0 }
    }

    const cfg = this.config!

    this.emitProgress('push', 10, 'Verificando schema remoto...')
    const remoteGen = cfg.lastRemoteGeneration ?? 0

    this.emitProgress('push', 30, 'Subiendo OpLog a Drive...')

    try {
      const binary = save(this.localDoc!)
      const result = await oplogDriveService.uploadOplog(
        binary,
        remoteGen > 0 ? remoteGen : undefined,
      )

      cfg.lastRemoteGeneration = result.generation
      cfg.lastPushAt = new Date().toISOString()
      cfg.lastSyncAt = new Date().toISOString()
      await oplogStateService.writeConfig(cfg)

      this.pendingEvents = []

      this.emitProgress('push', 100, `${localPending} eventos subidos`)
      return { pushed: localPending }
    } catch (err) {
      if (err instanceof OplogConcurrencyError) {
        this.emitProgress('push', 50, 'Conflicto detectado: re-mergeando...')
        cfg.lastRemoteGeneration = err.remoteGeneration
        await oplogStateService.writeConfig(cfg)

        const { newEventsCount, remoteGeneration } = await this.pull()

        if (this.pendingEvents.length > 0) {
          return this.push()
        }

        return { pushed: 0 }
      }
      throw err
    }
  }

  async syncBlobs(): Promise<{ downloaded: number; uploaded: number; deleted: number }> {
    if (!this.config) throw new Error('Oplog not initialized')

    if (!(await oplogDriveService.isAvailable())) {
      this.emitProgress('blob', 100, 'Drive no conectado')
      return { downloaded: 0, uploaded: 0, deleted: 0 }
    }

    this.emitProgress('blob', 5, 'Migrando blobs de medios legacy...')
    const migratedBlobs = await oplogMigrationService.migrateExistingMediaBlobs()
    if (migratedBlobs > 0) {
      log.warn(`[OplogBlob] ${migratedBlobs} blobs migrados del manifest legacy`)
    }

    this.emitProgress('blob', 10, 'Escaneando blobs activos...')
    const ops = this.localDoc?.ops ?? []
    const activeChecksums = new Set<string>()
    const opsLen = ops.length

    for (let idx = 0; idx < opsLen; idx++) {
      const op = ops[idx]
      if (op.op === 'upsert' && op.checksum && (op.entityType === 'media' || op.entityType === 'font')) {
        activeChecksums.add(op.checksum)
      }
      if (idx % 500 === 0 && idx > 0) {
        this.emitProgress('blob', 12, `Escaneando blobs activos... ${idx}/${opsLen}`)
      }
    }

    const toDownload: Array<{ checksum: string; path: string }> = []
    const toUpload: Array<{ checksum: string; localPath: string }> = []
    const seenChecksums = new Set<string>()

    const mediaRoot = getMediaDir()

    for (let idx = 0; idx < opsLen; idx++) {
      const op = ops[idx]
      if (op.op === 'upsert' && op.checksum) {
        if (seenChecksums.has(op.checksum)) continue
        if (op.data?.filePath) {
          const localPath = path.join(mediaRoot, op.data.filePath as string)
          seenChecksums.add(op.checksum)
          if (await fs.pathExists(localPath)) {
            toUpload.push({ checksum: op.checksum, localPath })
          } else {
            toDownload.push({ checksum: op.checksum, path: op.data.filePath as string })
          }
        } else if (op.blobPath) {
          const localPath = path.join(mediaRoot, op.blobPath)
          seenChecksums.add(op.checksum)
          if (await fs.pathExists(localPath)) {
            toUpload.push({ checksum: op.checksum, localPath })
          } else {
            toDownload.push({ checksum: op.checksum, path: op.blobPath })
          }
        }
      }
      if (idx % 500 === 0 && idx > 0) {
        this.emitProgress('blob', 20, `Verificando archivos locales... ${idx}/${opsLen}`)
      }
    }

    if (!this.blobFallbackDone) {
      const fallbackLen = opsLen
      for (let idx = 0; idx < fallbackLen; idx++) {
        const op = ops[idx]
        if (op.op !== 'upsert') continue
        const isBlobType = op.entityType === 'media' || op.entityType === 'font'
        if (!isBlobType || op.checksum) continue

        const filePath = op.data?.filePath as string | undefined
        const blobPath = op.blobPath
        const relPath = filePath ?? blobPath
        if (!relPath) continue

        const cached = this.checksumCache.get(relPath)
        if (cached) {
          if (seenChecksums.has(cached)) continue
          seenChecksums.add(cached)
          activeChecksums.add(cached)
          const localPath = path.join(mediaRoot, relPath)
          if (await fs.pathExists(localPath)) {
            toUpload.push({ checksum: cached, localPath })
          } else {
            toDownload.push({ checksum: cached, path: relPath })
          }
          continue
        }

        const localPath = path.join(mediaRoot, relPath)
        if (await fs.pathExists(localPath)) {
          const checksum = await oplogBlobService.computeChecksum(localPath)
          if (seenChecksums.has(checksum)) continue
          seenChecksums.add(checksum)
          this.checksumCache.set(relPath, checksum)
          activeChecksums.add(checksum)
          toUpload.push({ checksum, localPath })
        }
        if (idx % 200 === 0 && idx > 0) {
          this.emitProgress('blob', 35, `Fallback: generando checksums... ${idx}/${fallbackLen}`)
        }
      }
      this.blobFallbackDone = true
    }

    const blobOps: Array<any> = [
      ...toUpload.map(b => ({ type: 'upload' as const, checksum: b.checksum, localPath: b.localPath })),
      ...toDownload.map(b => ({ type: 'download' as const, checksum: b.checksum, path: b.path })),
    ]
    const totalBlobs = blobOps.length
    this.emitProgress('blob', 50, `Procesando 0/${totalBlobs} blobs...`)
    const blobResult = await oplogBlobService.processBlobOps(
      blobOps,
      (current, total) => {
        const pct = Math.min(50 + Math.round((current / total) * 40), 90)
        this.emitProgress('blob', pct, `Procesando ${current}/${total} blobs...`)
      },
    )

    this.emitProgress('blob', 80, 'Limpiando blobs huérfanos...')
    const gcDeleted = await oplogBlobService.garbageCollectBlobs(activeChecksums)

    this.emitProgress('blob', 100, `${blobResult.downloaded} descargados, ${gcDeleted} GC`)
    return {
      downloaded: blobResult.downloaded,
      uploaded: blobResult.uploaded,
      deleted: gcDeleted,
    }
  }

  async syncCycle(): Promise<SyncCycleResult> {
    if (!this.config) {
      const ok = await this.ensureInitialized()
      if (!ok) throw new Error('Oplog not initialized')
    }

    const result: SyncCycleResult = { pulled: 0, pushed: 0, blobsDownloaded: 0, blobsUploaded: 0, errors: [] }

    try {
      const pullResult = await this.runMappedPhase('pull', '1/3 Pull', 0, 33, () => this.pull())
      result.pulled = pullResult.newEventsCount

      const pushResult = await this.runMappedPhase('push', '2/3 Push', 33, 66, () => this.push())
      result.pushed = pushResult.pushed

      const blobResult = await this.runMappedPhase('blob', '3/3 Blobs', 66, 100, () => this.syncBlobs())
      result.blobsDownloaded = blobResult.downloaded
      result.blobsUploaded = blobResult.uploaded
    } catch (err: any) {
      result.errors.push(err.message)
      this.emitProgress('idle', 0, `Error: ${err.message}`)
    }

    this.config!.lastSyncAt = new Date().toISOString()
    await oplogStateService.writeConfig(this.config!)

    return result
  }
}

export const oplogService = new OplogService()
