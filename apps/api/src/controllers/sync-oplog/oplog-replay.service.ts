import { getPrisma, runWithoutOplogTracking } from '../../prisma'
import { getPrismaModelFields } from './oplog-utils'
import type { OplogEvent, EntityType, BlobOperation } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'

export interface ApplyResult {
  applied: number
  skipped: number
  errors: string[]
  blobOps: BlobOperation[]
}

export class OplogReplayService {
  async applyEvents(events: OplogEvent[]): Promise<ApplyResult> {
    return runWithoutOplogTracking(async () => {
      const result: ApplyResult = { applied: 0, skipped: 0, errors: [], blobOps: [] }

      for (const event of events) {
        try {
          await this.applySingleEvent(event, result)
          result.applied++
        } catch (err: any) {
          result.errors.push(`[${event.id}] ${event.entityType}:${event.entityId} — ${err.message}`)
        }
      }

      return result
    })
  }

  private async applySingleEvent(event: OplogEvent, result: ApplyResult): Promise<void> {
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

    switch (event.op) {
      case 'upsert': {
        const filteredData = this.filterFields(event.data ?? {}, validFields)
        if (Object.keys(filteredData).length === 0 && validFields.size > 0) {
          result.skipped++
          return
        }

        const recordId = this.parseId(event.entityId)

        try {
          await delegate.upsert({
            where: { id: recordId },
            create: { id: recordId, ...filteredData },
            update: filteredData,
          })
        } catch (upsertErr: any) {
          if (upsertErr.code === 'P2022') {
            const retryData = this.filterFields(event.data ?? {}, validFields, true)
            await delegate.upsert({
              where: { id: recordId },
              create: { id: recordId, ...retryData },
              update: retryData,
            })
          } else {
            throw upsertErr
          }
        }

        if (event.checksum && event.data?.filePath) {
          result.blobOps.push({
            type: 'download',
            checksum: event.checksum,
            path: event.data.filePath as string,
          })
        }
        break
      }

      case 'delete': {
        const recordId = this.parseId(event.entityId)

        if (event.entityType === 'media') {
          const existing = await (delegate as any).findUnique({
            where: { id: recordId },
            select: { checksum: true, filePath: true },
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
