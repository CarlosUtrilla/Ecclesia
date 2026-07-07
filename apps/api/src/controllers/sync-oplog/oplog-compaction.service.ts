import { from, type Doc } from '@automerge/automerge'
import { getPrisma } from '../../prisma'
import { getPrismaModelFields } from './oplog-utils'
import type { OplogDocument, EntityType, OplogEvent } from './oplog.types'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from './oplog.types'

export class OplogCompactionService {
  async buildSnapshot(
    schemaHash: string,
    ops: OplogEvent[],
    createdAt: number
  ): Promise<Doc<OplogDocument>> {
    const entities: Record<string, Record<string, Record<string, unknown>>> = {}
    const prisma = getPrisma()

    for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
      const delegate = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)]
      if (!delegate) continue

      const validFields = getPrismaModelFields(modelName)
      const scalarFields = [...validFields]

      try {
        const records = await delegate.findMany({
          select: scalarFields.reduce((acc: any, f) => { acc[f] = true; return acc }, {}),
        })

        const entityMap: Record<string, Record<string, unknown>> = {}
        for (const record of records) {
          entityMap[String(record.id)] = this.stripRelations(record)
        }
        entities[entityType] = entityMap
      } catch {
        continue
      }
    }

    const lastEventByDevice = this.getLastEventMetadata(ops)

    const doc = from<OplogDocument>({
      schemaVersion: 1,
      schemaHash,
      createdAt,
      ops: [],
      snapshot: {
        takenAt: Date.now(),
        takenFrom: lastEventByDevice,
        entities,
      },
    })

    return doc
  }

  private stripRelations(record: any): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        continue
      }
      result[key] = value
    }
    return result
  }

  private getLastEventMetadata(ops: OplogEvent[]): Array<{ deviceId: string; seq: number }> {
    const byDevice = new Map<string, number>()
    for (const op of ops) {
      const existing = byDevice.get(op.deviceId) ?? 0
      if (op.seq > existing) {
        byDevice.set(op.deviceId, op.seq)
      }
    }
    return Array.from(byDevice.entries()).map(([deviceId, seq]) => ({ deviceId, seq }))
  }
}

export const oplogCompactionService = new OplogCompactionService()
