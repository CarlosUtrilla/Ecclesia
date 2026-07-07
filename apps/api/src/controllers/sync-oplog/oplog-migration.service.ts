import { from, save, load, type Doc } from '@automerge/automerge'
import { getPrisma } from '../../prisma'
import { getPrismaModelFields, computeSchemaHash } from './oplog-utils'
import { oplogStateService } from './oplog-state.service'
import { oplogDriveService } from './oplog-drive.service'
import { oplogBlobService } from './oplog-blob.service'
import type { OplogDocument, EntityType, OplogEvent } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'
import { getMediaDir, getLocalMediaManifestPath } from '../sync/sync.config'
import path from 'path'
import fs from 'fs-extra'
import { randomUUID } from 'crypto'
import log from 'electron-log'

export class OplogMigrationService {
  private dbBlobMigrationDone = false

  async bootstrapOplog(deviceId: string): Promise<Doc<OplogDocument>> {
    const schemaHash = computeSchemaHash()
    const createdAt = Date.now()
    const prisma = getPrisma()
    const ops: OplogEvent[] = []
    let seq = 0

    for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
      const delegate = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)]
      if (!delegate) continue

      const validFields = getPrismaModelFields(modelName)
      const scalarFields = [...validFields]

      try {
        const records = await delegate.findMany({
          select: scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {}),
        })

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
              }
            }
          }

          ops.push(event)
        }
      } catch (err: any) {
        log.warn(`[OplogMigration] Error reading ${entityType}:`, err.message)
      }
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
    let uploaded = 0
    const knownChecksums = new Set<string>()

    try {
      const manifestPath = getLocalMediaManifestPath()
      const manifest = await fs.readJson(manifestPath).catch(() => ({ entries: [] }))

      for (const entry of manifest.entries ?? []) {
        if (entry.checksum && entry.path) {
          knownChecksums.add(entry.checksum)
          const localPath = path.join(mediaRoot, entry.path)
          if (await fs.pathExists(localPath)) {
            await oplogBlobService.processBlobOps([
              { type: 'upload', checksum: entry.checksum, localPath },
              { type: 'download', checksum: entry.checksum, path: entry.path },
            ])
            uploaded++
          }
        }
      }
    } catch (err: any) {
      log.warn('[OplogMigration] Error migrating legacy manifest blobs:', err.message)
    }

    if (!this.dbBlobMigrationDone) {
      try {
        const prisma = getPrisma()
        const allMedia = await prisma.media.findMany({
          where: { deletedAt: null },
          select: { id: true, filePath: true },
        })
        const mediaRecords = allMedia.filter(r => r.filePath !== null)
        const allFonts = await prisma.font.findMany({
          where: { deletedAt: null },
          select: { id: true, filePath: true },
        })
        const fontRecords = allFonts.filter(r => r.filePath !== null)
        const records = [
          ...mediaRecords.map(r => ({ type: 'media' as const, filePath: r.filePath!, recordId: r.id })),
          ...fontRecords.map(r => ({ type: 'font' as const, filePath: r.filePath!, recordId: r.id })),
        ]

        for (const rec of records) {
          const fullPath = path.join(mediaRoot, rec.filePath)
          if (!(await fs.pathExists(fullPath))) continue

          const checksum = await oplogBlobService.computeChecksum(fullPath)
          if (knownChecksums.has(checksum)) continue
          knownChecksums.add(checksum)

          await oplogBlobService.processBlobOps([
            { type: 'upload', checksum, localPath: fullPath },
          ])
          uploaded++
        }

        this.dbBlobMigrationDone = true
      } catch (err: any) {
        log.warn('[OplogMigration] Error migrating DB-based blobs:', err.message)
      }
    }

    return uploaded
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
    const alreadyHasOplog = await this.isOplogAlreadyPresent()
    if (alreadyHasOplog) {
      log.info('[OplogMigration] OpLog already exists locally, skipping bootstrap')
      return 'local'
    }

    if (await oplogDriveService.isAvailable()) {
      const remote = await oplogDriveService.downloadOplog().catch(() => null)
      if (remote) {
        const remoteDoc = load<OplogDocument>(remote.data)
        const opsCount = remoteDoc.ops?.length ?? 0
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
      }
    }

    log.info('[OplogMigration] Bootstrapping OpLog from current DB state...')
    const doc = await this.bootstrapOplog(deviceId)
    const opsCount = (doc.ops ?? []).length

    const binary = save(doc)
    await oplogStateService.writeOplogBinary(binary)

    await oplogStateService.writeReplayState({
      lastAppliedIndex: opsCount - 1,
      lastAppliedEventId: opsCount > 0 ? doc.ops![opsCount - 1].id : null,
      snapshotAppliedAt: null,
      appliedAt: new Date().toISOString(),
    })

    try {
      log.info('[OplogMigration] Uploading initial OpLog to Drive...')
      await oplogDriveService.uploadOplog(binary)
    } catch (err: any) {
      log.warn('[OplogMigration] Upload to Drive skipped (Drive not configured yet):', err.message)
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
