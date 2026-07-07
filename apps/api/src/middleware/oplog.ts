import { PrismaClient } from '@prisma/client'
import { oplogContext } from '../prisma'
import { oplogService } from '../controllers/sync-oplog/oplog.service'
import { ENTITY_TYPE_TO_PRISMA_MODEL } from '../controllers/sync-oplog/oplog.types'
import type { EntityType } from '../controllers/sync-oplog/oplog.types'

const TRACKED_ACTIONS = new Set([
  'create',
  'update',
  'upsert',
  'delete',
  'deleteMany',
  'updateMany',
  'createMany',
  'createManyAndReturn',
])

const EXCLUDED_MODELS = new Set([
  'SyncState',
  'SyncOutboxChange',
  'SyncInboxChange',
  'BibleSchema',
  'BibleVerses',
])

const PRISMA_MODEL_TO_ENTITY_TYPE: Record<string, EntityType> = {}
for (const [entityType, modelName] of Object.entries(ENTITY_TYPE_TO_PRISMA_MODEL)) {
  PRISMA_MODEL_TO_ENTITY_TYPE[modelName] = entityType as EntityType
}

function toDelegateName(model: string) {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`
}

function getRecordId(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null
  const id = (record as Record<string, unknown>).id
  if (typeof id === 'string' || typeof id === 'number') return String(id)
  return null
}

export function registerOplogMiddleware(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            !model ||
            !TRACKED_ACTIONS.has(operation) ||
            EXCLUDED_MODELS.has(model) ||
            oplogContext.getStore()?.skipOplog
          ) {
            return await query(args)
          }

          const entityType = PRISMA_MODEL_TO_ENTITY_TYPE[model]
          if (!entityType) {
            return await query(args)
          }

          const delegateName = toDelegateName(model)
          const delegate = (client as unknown as Record<string, unknown>)[delegateName]

          if (operation === 'delete') {
            let recordBefore: unknown = null
            if (delegate && typeof delegate === 'object' && 'findUnique' in delegate) {
              recordBefore = await (delegate as any).findUnique({
                where: args.where,
              })
            }
            const result = await query(args)
            const entityId = getRecordId(recordBefore) ?? getRecordId(result)
            if (entityId) {
              await oplogService.appendEvent({
                entityType,
                entityId,
                op: 'delete',
                data: recordBefore ? (recordBefore as Record<string, unknown>) : undefined,
              })
            }
            return result
          }

          if (operation === 'deleteMany') {
            let recordsBefore: unknown[] = []
            if (delegate && typeof delegate === 'object' && 'findMany' in delegate) {
              recordsBefore = (await (delegate as any).findMany({
                where: args.where,
              })) as unknown[]
            }
            const result = await query(args)
            for (const record of recordsBefore) {
              const entityId = getRecordId(record)
              if (entityId) {
                await oplogService.appendEvent({
                  entityType,
                  entityId,
                  op: 'delete',
                  data: record as Record<string, unknown>,
                })
              }
            }
            return result
          }

          const isBulkUpdate = operation === 'updateMany'

          if (isBulkUpdate) {
            let recordsBefore: unknown[] = []
            if (delegate && typeof delegate === 'object' && 'findMany' in delegate) {
              recordsBefore = (await (delegate as any).findMany({
                where: args.where,
              })) as unknown[]
            }
            const result = await query(args)
            for (const record of recordsBefore) {
              const entityId = getRecordId(record)
              if (entityId) {
                await oplogService.appendEvent({
                  entityType,
                  entityId,
                  op: 'upsert',
                  data: { ...(record as Record<string, unknown>), ...(args.data as Record<string, unknown>) },
                })
              }
            }
            return result
          }

          const result = await query(args)

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = Array.isArray(result) ? result : []
            for (const row of rows) {
              const entityId = getRecordId(row)
              if (entityId) {
                await oplogService.appendEvent({
                  entityType,
                  entityId,
                  op: 'upsert',
                  data: row as Record<string, unknown>,
                })
              }
            }
            return result
          }

          const entityId = getRecordId(result)
          if (entityId) {
            await oplogService.appendEvent({
              entityType,
              entityId,
              op: 'upsert',
              data: result as Record<string, unknown>,
            })
          }

          return result
        },
      },
    },
  }) as unknown as PrismaClient
}
