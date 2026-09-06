import { from, save, load, type Doc } from '@automerge/automerge'
import { getPrisma } from '../../prisma'
import { getPrismaModelFields, computeSchemaHash } from './oplog-utils'
import { oplogStateService } from './oplog-state.service'
import { oplogDriveService } from './oplog-drive.service'
import { oplogBlobService } from './oplog-blob.service'
import type { OplogDocument, EntityType, OplogEvent } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'
import { getMediaDir, getLocalMediaManifestPath } from './oplog-shared'
import path from 'path'
import fs from 'fs-extra'
import { randomUUID } from 'crypto'
import log from 'electron-log'
import { oplogLogInfo, oplogLogWarn } from './oplog-logger'

export class OplogMigrationService {

  async bootstrapOplog(deviceId: string): Promise<Doc<OplogDocument>> {
    const schemaHash = computeSchemaHash()
    const createdAt = Date.now()
    const prisma = getPrisma()
    const ops: OplogEvent[] = []
    let seq = 0

    oplogLogInfo(`[Migration] bootstrapOplog starting for deviceId=${deviceId}`)
    oplogLogInfo(`[Migration] Total entity types to process: ${Object.keys(ENTITY_TYPE_TO_PRISMA_MODEL).length}`)

    for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
      const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
      const delegate = (prisma as any)[delegateKey]
      
      oplogLogInfo(`[Migration] Processing ${entityType} (${modelName}) via delegate '${delegateKey}': ${delegate ? 'found' : 'MISSING'}`)
      
      if (!delegate) {
        oplogLogWarn(`[Migration] SKIP: delegate '${delegateKey}' not found on prisma client`)
        continue
      }

      const validFields = getPrismaModelFields(modelName)
      const scalarFields = [...validFields]
      oplogLogInfo(`[Migration] ${entityType}: ${scalarFields.length} scalar fields: ${scalarFields.join(', ')}`)

      try {
        const selectObj = scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {})
        const records = await delegate.findMany({ select: selectObj })
        oplogLogInfo(`[Migration] ${entityType}: found ${records.length} records in DB`)

        for (const record of records) {
          const data = this.stripRelations(record)
          seq++

          const event: OplogEvent = {
            id: randomUUID(),
            seq,
            deviceId,
            timestamp: Date.now(),
            entityType: entityType as EntityType,
            entityId: String(record.id),
            op: 'upsert',
            data,
          }

          if (entityType === 'media' || entityType === 'font') {
            const filePath = (record as any).filePath
            if (filePath) {
              event.blobPath = filePath
              const fullPath = path.join(getMediaDir(), filePath)
              if (await fs.pathExists(fullPath)) {
                event.checksum = await oplogBlobService.computeChecksum(fullPath)
                oplogLogInfo(`[Migration] ${entityType}#${record.id}: checksum=${event.checksum}`)
              } else {
                oplogLogWarn(`[Migration] ${entityType}#${record.id}: file not found at ${fullPath}`)
              }
            }

            if (entityType === 'media') {
              const thumbnailPath = (record as any).thumbnail
              if (thumbnailPath) {
                event.thumbnailBlobPath = thumbnailPath
                const fullThumbnailPath = path.join(getMediaDir(), thumbnailPath)
                if (await fs.pathExists(fullThumbnailPath)) {
                  event.thumbnailChecksum = await oplogBlobService.computeChecksum(fullThumbnailPath)
                  oplogLogInfo(`[Migration] ${entityType}#${record.id}: thumbnailChecksum=${event.thumbnailChecksum}`)
                } else {
                  oplogLogWarn(`[Migration] ${entityType}#${record.id}: thumbnail not found at ${fullThumbnailPath}`)
                }
              }

              const fallbackPath = (record as any).fallback
              if (fallbackPath) {
                event.fallbackBlobPath = fallbackPath
                const fullFallbackPath = path.join(getMediaDir(), fallbackPath)
                if (await fs.pathExists(fullFallbackPath)) {
                  event.fallbackChecksum = await oplogBlobService.computeChecksum(fullFallbackPath)
                  oplogLogInfo(`[Migration] ${entityType}#${record.id}: fallbackChecksum=${event.fallbackChecksum}`)
                } else {
                  oplogLogWarn(`[Migration] ${entityType}#${record.id}: fallback not found at ${fullFallbackPath}`)
                }
              }
            }
          }

          ops.push(event)
        }
      } catch (err: any) {
        oplogLogWarn(`[Migration] Error reading ${entityType} (${modelName}): ${err.message}`, { stack: err.stack })
        log.warn(`[OplogMigration] Error reading ${entityType}:`, err.message)
      }
    }

    const mediaEvents = ops.filter(o => o.entityType === 'media')
    const mediaWithThumbnailChecksum = mediaEvents.filter(o => !!o.thumbnailChecksum)
    const mediaWithThumbnailPath = mediaEvents.filter(o => o.thumbnailBlobPath)
    oplogLogInfo(`[Migration] bootstrapOplog complete: ${ops.length} total events, seq=${seq}`)
    oplogLogInfo(`[Migration-DIAG] Media events: ${mediaEvents.length}, with thumbnailChecksum: ${mediaWithThumbnailChecksum.length}, with thumbnailBlobPath: ${mediaWithThumbnailPath.length}`)
    if (mediaWithThumbnailPath.length > mediaWithThumbnailChecksum.length) {
      oplogLogWarn(`[Migration-DIAG] ${mediaWithThumbnailPath.length - mediaWithThumbnailChecksum.length} media records have thumbnailBlobPath but no thumbnailChecksum (file missing?)`)
    }

    const doc = from<OplogDocument>({
      schemaVersion: 1,
      schemaHash,
      createdAt,
      ops,
    })

    return doc
  }

  async migrateExistingMediaBlobs(): Promise<number> {
    const mediaRoot = getMediaDir()
    const uploadOps: Array<{ checksum: string; localPath: string }> = []
    const seenChecksums = new Set<string>()

    try {
      const manifestPath = getLocalMediaManifestPath()
      const manifest = await fs.readJson(manifestPath).catch(() => ({ entries: [] }))

      for (const entry of manifest.entries ?? []) {
        if (entry.checksum && !seenChecksums.has(entry.checksum)) {
          seenChecksums.add(entry.checksum)
          const localPath = path.join(mediaRoot, entry.path)
          if (await fs.pathExists(localPath)) {
            uploadOps.push({ checksum: entry.checksum, localPath })
          }
        }
      }
    } catch (err: any) {
      log.warn('[OplogMigration] Error reading legacy manifest:', err.message)
    }

    if (uploadOps.length > 0) {
      const ops = uploadOps.map(u => ({ type: 'upload' as const, checksum: u.checksum, localPath: u.localPath }))
      await oplogBlobService.processBlobOps(ops)
    }

    return uploadOps.length
  }

  async isOplogAlreadyPresent(): Promise<boolean> {
    const existing = await oplogStateService.readOplogBinary()
    if (!existing || existing.length === 0) return false
    try {
      const doc = load<OplogDocument>(existing)
      return (doc.ops?.length ?? 0) > 0
    } catch {
      return false
    }
  }

  async performFullMigration(deviceId: string): Promise<'local' | 'remote'> {
    oplogLogInfo(`[Migration] performFullMigration starting for deviceId=${deviceId}`)
    
    const alreadyHasOplog = await this.isOplogAlreadyPresent()
    oplogLogInfo(`[Migration] isOplogAlreadyPresent: ${alreadyHasOplog}`)
    if (alreadyHasOplog) {
      oplogLogInfo('[Migration] OpLog already exists locally, skipping bootstrap')
      log.info('[OplogMigration] OpLog already exists locally, skipping bootstrap')
      return 'local'
    }

    if (await oplogDriveService.isAvailable()) {
      oplogLogInfo('[Migration] Drive is available, checking for remote OpLog...')
      // Sin generación conocida: aquí siempre interesa el cuerpo completo.
      const remote = await oplogDriveService.downloadOplog().catch(() => null)
      if (remote?.data) {
        const remoteDoc = load<OplogDocument>(remote.data)
        const opsCount = remoteDoc.ops?.length ?? 0
        oplogLogInfo(`[Migration] Remote OpLog found with ${opsCount} ops`)
        if (opsCount > 0) {
          log.info('[OplogMigration] OpLog remoto encontrado — descargando en vez de bootstrappear')
          await oplogStateService.writeOplogBinary(remote.data)

          await oplogStateService.writeReplayState({
            lastAppliedIndex: -1,
            lastAppliedEventId: null,
            snapshotAppliedAt: null,
            appliedAt: new Date().toISOString(),
          })
          return 'remote'
        }
        log.info('[OplogMigration] OpLog remoto vacío — bootstrapping desde DB local')
      } else {
        oplogLogInfo('[Migration] No remote OpLog found')
      }
    } else {
      oplogLogInfo('[Migration] Drive not available, will bootstrap from local DB')
    }

    oplogLogInfo('[Migration] Bootstrapping OpLog from current DB state...')
    log.info('[OplogMigration] Bootstrapping OpLog from current DB state...')
    const doc = await this.bootstrapOplog(deviceId)
    const opsCount = (doc.ops ?? []).length
    oplogLogInfo(`[Migration] Bootstrap produced ${opsCount} ops`)

    const binary = save(doc)
    await oplogStateService.writeOplogBinary(binary)
    oplogLogInfo(`[Migration] OpLog binary written: ${binary.length} bytes`)

    await oplogStateService.writeReplayState({
      lastAppliedIndex: opsCount - 1,
      lastAppliedEventId: opsCount > 0 ? doc.ops![opsCount - 1].id : null,
      snapshotAppliedAt: null,
      appliedAt: new Date().toISOString(),
    })

    try {
      log.info('[OplogMigration] Preparing to upload initial OpLog to Drive...')
      // Recheck drive and remote to avoid overwriting a remote OpLog that
      // may have appeared while we were bootstrapping (race on first-run).
      if (await oplogDriveService.isAvailable()) {
        const existingRemote = await oplogDriveService.downloadOplog().catch(() => null)
        if (existingRemote && (existingRemote.data?.length ?? 0) > 0) {
          log.info('[OplogMigration] Remote OpLog detected after bootstrap — skipping upload to avoid overwrite')
        } else {
          log.info('[OplogMigration] No remote OpLog present — uploading initial OpLog to Drive')
          await oplogDriveService.uploadOplog(binary)
        }
      } else {
        log.info('[OplogMigration] Drive not available at upload time — skipping upload')
      }
    } catch (err: any) {
      log.warn('[OplogMigration] Upload to Drive failed:', err?.message ?? err)
    }

    try {
      log.info('[OplogMigration] Migrating existing media blobs to Drive...')
      const uploaded = await this.migrateExistingMediaBlobs()
      log.info(`[OplogMigration] Migration complete: ${uploaded} blobs uploaded`)
    } catch (err: any) {
      log.warn('[OplogMigration] Media blob migration skipped:', err.message)
    }

    return 'local'
  }

  private stripRelations(record: any): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
        continue
      }
      if (Array.isArray(value)) {
        continue
      }
      result[key] = value instanceof Date ? value.toISOString() : value
    }
    return result
  }
}

export const oplogMigrationService = new OplogMigrationService()
