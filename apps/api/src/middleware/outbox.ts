import { PrismaClient, SyncOperation } from '@prisma/client'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { serializeOutboxPayload } from '../outboxPayload'
import { outboxContext } from '../prisma'

const SYNC_CONFIG_DIR_NAME = 'sync'
const SYNC_CONFIG_FILE_NAME = 'google-drive-config.json'
const OUTBOX_CACHE_TTL_MS = 5000

const OUTBOX_TRACKED_ACTIONS = new Set([
  'create',
  'update',
  'upsert',
  'delete',
  'deleteMany',
  'updateMany',
  'createMany',
  'createManyAndReturn'
])

const OUTBOX_EXCLUDED_MODELS = new Set(['SyncOutboxChange', 'SyncInboxChange', 'SyncState'])

let onOutboxWriteCallback: (() => void) | null = null
let onMediaChangeCallback: (() => void) | null = null

export function setOnOutboxWriteCallback(fn: () => void): void {
  onOutboxWriteCallback = fn
}

export function setOnMediaChangeCallback(fn: () => void): void {
  onMediaChangeCallback = fn
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!(await fs.pathExists(filePath))) return null
    return (await fs.readJSON(filePath)) as T
  } catch {
    return null
  }
}

type SyncIdentity = {
  workspaceId: string
  deviceId: string
}

type SyncConfigSnapshot = {
  enabled?: boolean
  workspaceId?: string
  deviceName?: string
}

type CachedSyncIdentity = {
  loadedAt: number
  value: SyncIdentity | null
}

let cachedSyncIdentity: CachedSyncIdentity = {
  loadedAt: 0,
  value: null
}

function getSyncConfigPath(userDataPath: string) {
  return path.join(userDataPath, SYNC_CONFIG_DIR_NAME, SYNC_CONFIG_FILE_NAME)
}

async function getSyncIdentityCached(userDataPath: string): Promise<SyncIdentity | null> {
  const now = Date.now()
  if (now - cachedSyncIdentity.loadedAt < OUTBOX_CACHE_TTL_MS) {
    return cachedSyncIdentity.value
  }

  const config = await readJsonSafe<SyncConfigSnapshot>(getSyncConfigPath(userDataPath))
  if (!config) {
    cachedSyncIdentity = { loadedAt: now, value: null }
    return null
  }

  const workspaceId = config.workspaceId?.trim() || 'default'
  const deviceId = config.deviceName?.trim() || os.hostname() || 'Este dispositivo'

  const value = { workspaceId, deviceId }
  cachedSyncIdentity = { loadedAt: now, value }
  return value
}

function getUpdatedAtFromRecord(record: unknown) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>).updatedAt
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function toRecordId(model: string, args: Record<string, unknown>, result: unknown) {
  if (result && typeof result === 'object') {
    const maybeId = (result as Record<string, unknown>).id
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      return String(maybeId)
    }
  }

  const where = args.where
  if (where && typeof where === 'object') {
    const entries = Object.entries(where as Record<string, unknown>)
    for (const [, value] of entries) {
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value)
      }
    }
  }

  const data = args.data
  if (data && typeof data === 'object') {
    const maybeId = (data as Record<string, unknown>).id
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      return String(maybeId)
    }
  }

  if (model === 'ScheduleItem' && where && typeof where === 'object') {
    const id = (where as Record<string, unknown>).id
    if (typeof id === 'string') return id
  }

  return null
}

function toPayloadString(args: Record<string, unknown>, result: unknown) {
  const payloadBase =
    result && typeof result === 'object' ? result : (args.data ?? args.where ?? {})
  return serializeOutboxPayload(payloadBase)
}

function toOperation(action: string): SyncOperation | null {
  if (action === 'create') return SyncOperation.CREATE
  if (action === 'createMany' || action === 'createManyAndReturn') return SyncOperation.CREATE
  if (action === 'update' || action === 'upsert') return SyncOperation.UPDATE
  if (action === 'updateMany') return SyncOperation.UPDATE
  if (action === 'delete') return SyncOperation.DELETE
  if (action === 'deleteMany') return SyncOperation.DELETE
  return null
}

function toDelegateName(model: string) {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`
}

function isRecordWithId(
  value: unknown
): value is { id: string | number; updatedAt?: Date | string | null } {
  if (!value || typeof value !== 'object') return false
  const id = (value as Record<string, unknown>).id
  return typeof id === 'string' || typeof id === 'number'
}

function normalizeDataArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  return []
}

async function appendOutboxEntry(
  client: PrismaClient,
  identity: SyncIdentity,
  data: {
    tableName: string
    recordId: string
    operation: SyncOperation
    payload: string
    entityUpdatedAt: Date
    deletedAt?: Date | null
  }
) {
  try {
    await client.syncOutboxChange.create({
      data: {
        workspaceId: identity.workspaceId,
        deviceId: identity.deviceId,
        tableName: data.tableName,
        recordId: data.recordId,
        operation: data.operation,
        payload: data.payload,
        entityUpdatedAt: data.entityUpdatedAt,
        deletedAt: data.deletedAt ?? null
      }
    })
    onOutboxWriteCallback?.()
  } catch (error) {
    console.error(
      `[sync-outbox] No se pudo registrar cambio ${data.tableName}.${data.operation}:`,
      error
    )
  }
}

export function registerOutboxMiddleware(client: PrismaClient, userDataPath: string): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            !model ||
            !OUTBOX_TRACKED_ACTIONS.has(operation) ||
            OUTBOX_EXCLUDED_MODELS.has(model)
          ) {
            return await query(args)
          }

          const delegateName = toDelegateName(model)
          const delegate = (client as unknown as Record<string, unknown>)[delegateName] as
            | {
                findMany: (args: Record<string, unknown>) => Promise<unknown[]>
              }
            | undefined

          let bulkTargetsBefore: Array<{ id: string; updatedAt?: Date | string | null }> = []
          if ((operation === 'deleteMany' || operation === 'updateMany') && delegate?.findMany) {
            try {
              const matches = await delegate.findMany({
                where: (args as Record<string, unknown>).where as Record<string, unknown>,
                select: { id: true, updatedAt: true }
              })
              bulkTargetsBefore = matches
                .filter(isRecordWithId)
                .map((row) => ({ id: String(row.id), updatedAt: row.updatedAt }))
            } catch (error) {
              console.error(
                `[sync-outbox] No se pudo pre-capturar registros para ${model}.${operation}:`,
                error
              )
            }
          }

          const result = await query(args)

          if (
            (model === 'Media' || model === 'Font') &&
            !outboxContext.getStore()?.skipOutbox
          ) {
            onMediaChangeCallback?.()
          }

          if (outboxContext.getStore()?.skipOutbox) {
            return result
          }

          const identity = await getSyncIdentityCached(userDataPath)
          if (!identity) {
            return result
          }

          const outboxOperation = toOperation(operation)
          if (!outboxOperation) {
            return result
          }

          if (operation === 'deleteMany') {
            const deletedAt = new Date()
            for (const target of bulkTargetsBefore) {
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: target.id,
                operation: outboxOperation,
                payload: serializeOutboxPayload({
                  id: target.id,
                  deletedAt: deletedAt.toISOString()
                }),
                entityUpdatedAt: deletedAt,
                deletedAt
              })
            }
            return result
          }

          if (operation === 'updateMany') {
            const dataPatch =
              args &&
              typeof args === 'object' &&
              'data' in args &&
              args.data &&
              typeof args.data === 'object'
                ? args.data
                : {}
            for (const target of bulkTargetsBefore) {
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: target.id,
                operation: outboxOperation,
                payload: serializeOutboxPayload({ id: target.id, ...dataPatch }),
                entityUpdatedAt: new Date()
              })
            }
            return result
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const dataArray =
              args && typeof args === 'object' && 'data' in args ? args.data : undefined
            const rows = normalizeDataArray(dataArray)
            for (const row of rows) {
              if (!isRecordWithId(row)) continue
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: String(row.id),
                operation: outboxOperation,
                payload: serializeOutboxPayload(row),
                entityUpdatedAt: new Date()
              })
            }
            return result
          }

          const recordId = toRecordId(model, args, result)
          if (!recordId) {
            return result
          }

          const entityUpdatedAt = getUpdatedAtFromRecord(result) ?? new Date()
          const deletedAt = outboxOperation === SyncOperation.DELETE ? new Date() : null

          await appendOutboxEntry(client, identity, {
            tableName: model,
            recordId,
            operation: outboxOperation,
            payload: toPayloadString(args, result),
            entityUpdatedAt,
            deletedAt
          })

          return result
        }
      }
    }
  }) as unknown as PrismaClient
}
