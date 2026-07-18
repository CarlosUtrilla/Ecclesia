import { getPrisma } from '../../prisma'
import { oplogLogInfo, oplogLogWarn } from './oplog-logger'
import type { OplogConfig, EntityType } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'

const DEFAULT_RETENTION_DAYS = 30

const PURGE_ORDER: EntityType[] = [
  'scheduleItem',
  'schedule',
  'song',
  'tagSongs',
  'media',
  'themes',
  'font',
  'presentation',
  'scheduleGroupTemplate',
]

interface PurgeResult {
  purged: Record<string, number>
  totalPurged: number
}

function isPurgeEligible(deletedAt: Date | null, config: OplogConfig, retentionDays: number): boolean {
  if (!deletedAt) return false
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  if (deletedAt.getTime() > cutoffMs) return false
  if (config.lastPushAt && new Date(config.lastPushAt) < deletedAt) return false
  if (config.lastPullAt && new Date(config.lastPullAt) < deletedAt) return false
  return true
}

export class OplogPurgeService {
  isPurgeDue(config: OplogConfig): boolean {
    if (!config.lastPurgeAt) return true
    const lastPurge = new Date(config.lastPurgeAt)
    const hoursSince = (Date.now() - lastPurge.getTime()) / (1000 * 60 * 60)
    return hoursSince >= 24
  }

  async purgeSoftDeleted(
    config: OplogConfig,
    retentionDays: number = DEFAULT_RETENTION_DAYS
  ): Promise<PurgeResult> {
    const prisma = getPrisma()
    const result: PurgeResult = { purged: {}, totalPurged: 0 }

    for (const entityType of PURGE_ORDER) {
      const modelName = ENTITY_TYPE_TO_PRISMA_MODEL[entityType]
      const delegate = (prisma as any)[modelName]
      if (!delegate) {
        oplogLogWarn(`[Purge] Model ${modelName} not found, skipping`)
        continue
      }

      let hasMore = true
      const BATCH_SIZE = 50
      let cursor: number | undefined

      while (hasMore) {
        const where: any = { deletedAt: { not: null } }
        const records: any[] = await delegate.findMany({
          where,
          select: { id: true, deletedAt: true },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
        })

        if (records.length === 0) {
          hasMore = false
          break
        }

        const eligible = records.filter((r) =>
          isPurgeEligible(r.deletedAt, config, retentionDays)
        )

        if (eligible.length === 0) {
          cursor = records[records.length - 1].id
          if (records.length < BATCH_SIZE) hasMore = false
          continue
        }

        let purgedCount = 0
        for (const record of eligible) {
          try {
            await delegate.delete({ where: { id: record.id } })
            purgedCount++
          } catch (err: any) {
            if (err.code === 'P2025') continue
            oplogLogWarn(`[Purge] Failed to delete ${modelName} id=${record.id}: ${err.message}`)
          }
        }

        if (purgedCount > 0) {
          result.purged[entityType] = (result.purged[entityType] ?? 0) + purgedCount
          result.totalPurged += purgedCount
          oplogLogInfo(`[Purge] Purged ${purgedCount} ${modelName} records`)
        }

        if (records.length > 0) {
          cursor = records[records.length - 1].id
        }
        if (records.length < BATCH_SIZE) hasMore = false
      }
    }

    return result
  }
}

export const oplogPurgeService = new OplogPurgeService()
