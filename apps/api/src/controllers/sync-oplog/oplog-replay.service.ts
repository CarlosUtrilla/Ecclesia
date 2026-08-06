import { getPrisma, runWithoutOplogTracking } from '../../prisma'
import { getPrismaModelFields } from './oplog-utils'
import type { OplogEvent, EntityType, BlobOperation } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'
import { oplogLogInfo, oplogLogWarn, oplogLogError } from './oplog-logger'
import { oplogBlobService } from './oplog-blob.service'
import { getMediaDir } from './oplog-shared'
import fs from 'fs-extra'
import path from 'path'

export interface ApplyResult {
  applied: number
  skipped: number
  errors: string[]
  blobOps: BlobOperation[]
}

export class OplogReplayService {
  async applyEvents(events: OplogEvent[]): Promise<ApplyResult> {
    oplogLogInfo(`[Replay] applyEvents called with ${events.length} events`)
    return runWithoutOplogTracking(async () => {
      const result: ApplyResult = { applied: 0, skipped: 0, errors: [], blobOps: [] }

      const priority: Record<EntityType, number> = {
        biblePresentationSettings: 0,
        media: 1,
        font: 2,
        themes: 3,
        presentation: 4,
        stageScreenConfig: 5,
        song: 6,
        tagSongs: 7,
        schedule: 8,
        scheduleGroupTemplate: 9,
        scheduleItem: 10,
        // selectedScreens must be applied before StageScreenConfig because
        // StageScreenConfig.selectedScreenId has a FK to SelectedScreens.
        // Put selectedScreens early in the priority list so referenced
        // rows exist when stageScreenConfig upserts run.
        selectedScreens: 2,
        setting: 12,
      }

      const sorted = [...events].sort((a, b) => {
        const pa = priority[a.entityType] ?? 99
        const pb = priority[b.entityType] ?? 99
        if (pa !== pb) return pa - pb
        return (a.seq ?? 0) - (b.seq ?? 0)
      })

      oplogLogInfo(`[Replay] Sorted ${sorted.length} events by priority`)

      // idRemap keeps track of applied entity id mappings across replays
      const idRemap = new Map<string, Map<string, unknown>>()

      // Retry queue: implement round-based retry for FK violations (P2003 / "foreign key")
      const MAX_RETRIES = 10
      const attempts = new Map<string, number>()

      // Initialize queue as a FIFO array
      let queue: OplogEvent[] = [...sorted]

      // Process rounds until queue empty or retries exhausted
      while (queue.length > 0) {
        const nextQueue: OplogEvent[] = []
        let progressInThisRound = 0

        for (const event of queue) {
          try {
            await this.applySingleEvent(event, result, idRemap)
            result.applied++
            progressInThisRound++
          } catch (err: any) {
            const msg = String(err?.message ?? err)
            oplogLogWarn(`[Replay] Error applying event ${event.id}: ${msg}`)

            // Detect FK errors: Prisma P2003 or message mentioning foreign key
            const isFkError = err?.code === 'P2003' || /foreign key/i.test(msg)

            if (isFkError) {
              const prev = attempts.get(event.id) ?? 0
              const next = prev + 1
              attempts.set(event.id, next)

              if (next <= MAX_RETRIES) {
                // Re-enqueue to try after other events are processed
                oplogLogInfo(`[Replay] Deferring event ${event.id} (attempt ${next}/${MAX_RETRIES}) due to FK error`)
                nextQueue.push(event)
              } else {
                oplogLogWarn(`[Replay] Dropping event ${event.id} after ${next - 1} retries: ${msg}`)
                result.errors.push(`[${event.id}] ${event.entityType}:${event.entityId} — ${msg} (retries=${next - 1})`)
              }
            } else {
              // Non-FK error: record and don't retry
              result.errors.push(`[${event.id}] ${event.entityType}:${event.entityId} — ${msg}`)
            }
          }
        }

        if (nextQueue.length === 0) {
          // Nothing to retry — we're done
          break
        }

        if (progressInThisRound === 0) {
          // No progress made during this round: log to help diagnosis.
          oplogLogWarn(`[Replay] No progress made in retry round; ${nextQueue.length} events remain (will retry up to ${MAX_RETRIES} attempts each)`)
          // If none of the deferred events can make progress now, we'll still attempt
          // the next round, but the attempts counter will ensure we stop after MAX_RETRIES.
        }

        // Prepare for next round
        queue = nextQueue
      }

      oplogLogInfo(`[Replay] applyEvents complete: ${result.applied} applied, ${result.skipped} skipped, ${result.errors.length} errors, ${result.blobOps.length} blobOps`)
      return result
    })
  }

  private async applySingleEvent(
    event: OplogEvent,
    result: ApplyResult,
    idRemap: Map<string, Map<string, number>>,
  ): Promise<void> {
    const modelName = ENTITY_TYPE_TO_PRISMA_MODEL[event.entityType]
    if (!modelName) {
      result.skipped++
      return
    }

    const prisma = getPrisma()
    const delegate = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)]
    if (!delegate) {
      result.skipped++
      return
    }

    const validFields = getPrismaModelFields(modelName)

    const remapFk = (entityType: EntityType, value: unknown): unknown => {
      if (value === null || value === undefined) return value
      const typeMap = idRemap.get(entityType)
      if (!typeMap) return value

      // Try direct lookup (handles string IDs / UUIDs)
      const asString = String(value)
      if (typeMap.has(asString)) {
        return typeMap.get(asString)
      }

      // If value looks numeric, try numeric lookup as well
      const num = Number(value)
      if (Number.isFinite(num) && Number.isInteger(num)) {
        const remapped = typeMap.get(String(num))
        return remapped ?? value
      }

      return value
    }

    switch (event.op) {
      case 'upsert': {
        const data = { ...(event.data ?? {}) }
        if (event.entityType === 'themes') {
          data.backgroundMediaId = remapFk('media', data.backgroundMediaId)
          data.biblePresentationSettingsId = remapFk('biblePresentationSettings', data.biblePresentationSettingsId)
        }
        if (event.entityType === 'stageScreenConfig') {
          data.themeId = remapFk('themes', data.themeId)
        }
        if (event.entityType === 'scheduleItem') {
          // scheduleItem.accessData references songs/media/etc. by string — no remap needed
        }
        if (event.entityType === 'media') {
          // Derivar `type` desde `format` cuando falte (capturado en versiones
          // anteriores del schema donde `type` no estaba como required).
          if (!data.type && typeof data.format === 'string') {
            const fmt = data.format.toLowerCase()
            if (fmt === 'pdf') {
              data.type = 'PDF'
            } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(fmt)) {
              data.type = 'VIDEO'
            } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(fmt)) {
              data.type = 'IMAGE'
            } else {
              data.type = 'IMAGE'
            }
          }
        }

        const filteredData = this.filterFields(data, validFields)
        if (Object.keys(filteredData).length === 0 && validFields.size > 0) {
          result.skipped++
          return
        }

        // Setting: la identidad real es `key` (no el `id` autoincremental local) y
        // `key` es un enum incompleto, así que se hace upsert por key con SQL raw
        // (evita validación de enum y colisiones de id entre dispositivos).
        if (event.entityType === 'setting') {
          const key = (filteredData as Record<string, unknown>).key
          const rawValue = (filteredData as Record<string, unknown>).value
          if (typeof key !== 'string' || key.length === 0) {
            result.skipped++
            return
          }
          const value = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')
          await prisma.$executeRawUnsafe(
            'INSERT INTO Setting (key, value, createdAt, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP',
            key,
            value
          )
          break
        }

        const recordId = this.parseId(event.entityId)

        try {
          oplogLogInfo(`[Replay] Upserting ${event.entityType} id=${recordId} fields=${Object.keys(filteredData).length}`)
          await delegate.upsert({
            where: { id: recordId },
            create: { id: recordId, ...filteredData },
            update: filteredData,
          })
        } catch (upsertErr: any) {
          oplogLogWarn(`[Replay] Upsert failed for ${event.id} ${event.entityType}:${event.entityId} — ${upsertErr?.message ?? upsertErr}`)
          oplogLogWarn(`[Replay] Upsert error code: ${upsertErr?.code ?? 'unknown'}`)
          // Log a trimmed payload for diagnosis
          try {
            const preview = JSON.stringify(filteredData, (_k, v) => (typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v))
            oplogLogWarn(`[Replay] Filtered data preview: ${preview}`)
          } catch {}

          if (upsertErr.code === 'P2022') {
            const retryData = this.filterFields(data, validFields, true)
            try {
              await delegate.upsert({
                where: { id: recordId },
                create: { id: recordId, ...retryData },
                update: retryData,
              })
            } catch (retryErr: any) {
              oplogLogWarn(`[Replay] Retry upsert also failed: ${retryErr?.message ?? retryErr}`)
              throw retryErr
            }
          } else {
            throw upsertErr
          }
        }

        if (!idRemap.has(event.entityType)) {
          idRemap.set(event.entityType, new Map())
        }
        idRemap.get(event.entityType)!.set(String(recordId), recordId)

        if (event.entityType === 'media') {
          const filePath = (event.data?.filePath as string) ?? event.blobPath
          if (event.checksum && filePath) {
            result.blobOps.push({ type: 'download', checksum: event.checksum, path: filePath })
          }

          const thumbnailPath = (event.data?.thumbnail as string) ?? event.thumbnailBlobPath
          if (event.thumbnailChecksum && thumbnailPath) {
            result.blobOps.push({ type: 'download', checksum: event.thumbnailChecksum, path: thumbnailPath })
          }

          const fallbackPath = (event.data?.fallback as string) ?? event.fallbackBlobPath
          if (event.fallbackChecksum && fallbackPath) {
            result.blobOps.push({ type: 'download', checksum: event.fallbackChecksum, path: fallbackPath })
          }
        }
        break
      }

      case 'delete': {
        const recordId = this.parseId(event.entityId)

        if (event.entityType === 'media') {
          const existing = await (delegate as any).findUnique({
            where: { id: recordId },
            select: { checksum: true, filePath: true, thumbnail: true, fallback: true },
          }).catch(() => null)

          if (existing?.checksum) {
            const remainingCount = await (delegate as any).count({
              where: { checksum: existing.checksum, deletedAt: null, id: { not: recordId } },
            })

            if (remainingCount === 0) {
              result.blobOps.push({
                type: 'delete',
                checksum: existing.checksum,
                path: existing.filePath ?? existing.checksum,
              })
            }
          }

          const addThumbnailDelete = async (pathField: string | null | undefined) => {
            if (!pathField) return
            const fullPath = path.join(getMediaDir(), pathField)
            if (!(await fs.pathExists(fullPath))) return
            const checksum = await oplogBlobService.computeChecksum(fullPath)
            const remainingCount = await (delegate as any).count({
              where: {
                thumbnail: pathField,
                deletedAt: null,
                id: { not: recordId },
              },
            })
            if (remainingCount === 0) {
              result.blobOps.push({ type: 'delete', checksum, path: pathField })
            }
          }

          await addThumbnailDelete(existing?.thumbnail)
          await addThumbnailDelete(existing?.fallback)
        }

        try {
          await delegate.delete({ where: { id: recordId } })
        } catch (deleteErr: any) {
          if (deleteErr.code === 'P2025') {
            return
          }
          throw deleteErr
        }
        break
      }
    }
  }

  private filterFields(
    data: Record<string, unknown>,
    validFields: Set<string>,
    strict = false
  ): Record<string, unknown> {
    // If we couldn't obtain Prisma model fields (empty set), fall back
    // to returning the original data so replay can still apply events.
    if (!validFields || validFields.size === 0) {
      return { ...data }
    }

    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (validFields.has(key)) {
        filtered[key] = value
      }
    }
    return filtered
  }

  private parseId(entityId: string): number | string {
    const num = Number(entityId)
    return Number.isFinite(num) && Number.isInteger(num) ? num : entityId
  }
}

export const oplogReplayService = new OplogReplayService()
