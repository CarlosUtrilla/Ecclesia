import { Prisma, SyncOperation } from '@prisma/client'
import { getPrisma, runWithoutSyncOutboxTracking } from '../../../electron/main/prisma'
import {
  ApplyPendingInboxBatchDTO,
  AckOutboxChangesDTO,
  AppendOutboxChangeDTO,
  IngestRemoteChangesDTO,
  MarkInboxAppliedDTO,
  PendingInboxChangesDTO,
  PendingOutboxChangesDTO,
  SyncStateDTO,
  UpsertSyncStateDTO
} from './sync.dto'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

function parseDateOrNull(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function clampLimit(value?: number) {
  if (!value || value <= 0) return DEFAULT_LIMIT
  return Math.min(value, MAX_LIMIT)
}

function requireValidDate(value: string, fieldName: string) {
  const parsed = parseDateOrNull(value)
  if (!parsed) {
    throw new Error(`${fieldName} es obligatorio y debe ser una fecha válida en formato ISO`)
  }
  return parsed
}

function isSameOrOlder(candidate: Date, current?: Date | null) {
  if (!current) return false
  return candidate.getTime() <= current.getTime()
}

function parseNumericIdOrNull(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parsePayloadObject(payload: string, changeId: number) {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('payload no es un objeto JSON')
    }
    return parsed
  } catch {
    throw new Error(`Payload inválido para cambio inbox ${changeId}`)
  }
}

function pickAllowedFields(payload: Record<string, unknown>, allowedFields: string[]) {
  const next: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      next[field] = payload[field]
    }
  }

  return next
}

type SyncTableDefinition = {
  delegateName: string
  allowedFields: string[]
  resolveWhere: (
    recordId: string,
    payload: Record<string, unknown>
  ) => Record<string, unknown> | null
  allowDelete: boolean
}

const SYNC_TABLE_DEFINITIONS: Record<string, SyncTableDefinition> = {
  Song: {
    delegateName: 'song',
    allowedFields: ['id', 'title', 'author', 'copyright', 'createdAt', 'updatedAt', 'fullText'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  Lyrics: {
    delegateName: 'lyrics',
    allowedFields: ['id', 'content', 'tagSongsId', 'songId', 'createdAt', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  TagSongs: {
    delegateName: 'tagSongs',
    allowedFields: ['id', 'name', 'shortName', 'shortCut', 'color', 'createdAt', 'updatedAt'],
    resolveWhere: (recordId, payload) => {
      const id = parseNumericIdOrNull(recordId)
      if (id !== null) return { id }
      if (typeof payload.shortCut === 'string') return { shortCut: payload.shortCut }
      if (typeof payload.shortName === 'string') return { shortName: payload.shortName }
      if (typeof payload.name === 'string') return { name: payload.name }
      return null
    },
    allowDelete: true
  },
  Font: {
    delegateName: 'font',
    allowedFields: ['id', 'name', 'fileName', 'filePath', 'createdAt', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  Themes: {
    delegateName: 'themes',
    allowedFields: [
      'id',
      'name',
      'background',
      'backgroundMediaId',
      'textStyle',
      'animationSettings',
      'transitionSettings',
      'previewImage',
      'createdAt',
      'updatedAt',
      'biblePresentationSettingsId',
      'useDefaultBibleSettings'
    ],
    resolveWhere: (recordId, payload) => {
      const id = parseNumericIdOrNull(recordId)
      if (id !== null) return { id }
      if (typeof payload.name === 'string') return { name: payload.name }
      return null
    },
    allowDelete: true
  },
  Setting: {
    delegateName: 'setting',
    allowedFields: ['id', 'key', 'value', 'createdAt', 'updatedAt'],
    resolveWhere: (recordId, payload) => {
      if (typeof payload.key === 'string') return { key: payload.key }
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  Media: {
    delegateName: 'media',
    allowedFields: [
      'id',
      'name',
      'type',
      'format',
      'filePath',
      'fileSize',
      'width',
      'height',
      'duration',
      'thumbnail',
      'fallback',
      'folder',
      'createdAt',
      'updatedAt'
    ],
    resolveWhere: (recordId, payload) => {
      const id = parseNumericIdOrNull(recordId)
      if (id !== null) return { id }
      if (typeof payload.filePath === 'string') return { filePath: payload.filePath }
      return null
    },
    allowDelete: true
  },
  Presentation: {
    delegateName: 'presentation',
    allowedFields: ['id', 'title', 'slides', 'createdAt', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  BibleSchema: {
    delegateName: 'bibleSchema',
    allowedFields: ['id', 'book', 'book_id', 'book_short', 'testament', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  BibleVerses: {
    delegateName: 'bibleVerses',
    allowedFields: ['id', 'chapter', 'verses', 'bibleSchemaId', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  BiblePresentationSettings: {
    delegateName: 'biblePresentationSettings',
    allowedFields: [
      'id',
      'description',
      'position',
      'showVersion',
      'showVerseNumber',
      'isGlobal',
      'positionStyle',
      'defaultTheme',
      'updatedAt'
    ],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  Schedule: {
    delegateName: 'schedule',
    allowedFields: ['id', 'title', 'dateFrom', 'dateTo', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  ScheduleGroupTemplate: {
    delegateName: 'scheduleGroupTemplate',
    allowedFields: ['id', 'name', 'color', 'updatedAt'],
    resolveWhere: (recordId) => {
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  ScheduleItem: {
    delegateName: 'scheduleItem',
    allowedFields: ['id', 'order', 'type', 'accessData', 'scheduleId', 'updatedAt'],
    resolveWhere: (recordId) => ({ id: recordId }),
    allowDelete: true
  },
  SelectedScreens: {
    delegateName: 'selectedScreens',
    allowedFields: ['id', 'screenId', 'screenName', 'rol', 'updatedAt'],
    resolveWhere: (recordId, payload) => {
      if (typeof payload.screenId === 'number') {
        return { screenId: payload.screenId }
      }
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  },
  StageScreenConfig: {
    delegateName: 'stageScreenConfig',
    allowedFields: [
      'id',
      'selectedScreenId',
      'themeId',
      'layout',
      'state',
      'createdAt',
      'updatedAt'
    ],
    resolveWhere: (recordId, payload) => {
      if (typeof payload.selectedScreenId === 'number') {
        return { selectedScreenId: payload.selectedScreenId }
      }
      const id = parseNumericIdOrNull(recordId)
      return id === null ? null : { id }
    },
    allowDelete: true
  }
}

class SyncService {
  async getSyncState(data: SyncStateDTO) {
    const prisma = getPrisma()
    return await prisma.syncState.findUnique({
      where: {
        workspaceId_deviceId: {
          workspaceId: data.workspaceId,
          deviceId: data.deviceId
        }
      }
    })
  }

  async upsertSyncState(data: UpsertSyncStateDTO) {
    const prisma = getPrisma()

    return await prisma.syncState.upsert({
      where: {
        workspaceId_deviceId: {
          workspaceId: data.workspaceId,
          deviceId: data.deviceId
        }
      },
      create: {
        workspaceId: data.workspaceId,
        deviceId: data.deviceId,
        lastPulledAt: parseDateOrNull(data.lastPulledAt),
        lastPushedAt: parseDateOrNull(data.lastPushedAt),
        lastAckedChangeId: data.lastAckedChangeId ?? null
      },
      update: {
        ...(data.lastPulledAt !== undefined && {
          lastPulledAt: parseDateOrNull(data.lastPulledAt)
        }),
        ...(data.lastPushedAt !== undefined && {
          lastPushedAt: parseDateOrNull(data.lastPushedAt)
        }),
        ...(data.lastAckedChangeId !== undefined && { lastAckedChangeId: data.lastAckedChangeId })
      }
    })
  }

  async appendOutboxChange(data: AppendOutboxChangeDTO) {
    const prisma = getPrisma()
    const entityUpdatedAt = requireValidDate(data.entityUpdatedAt, 'entityUpdatedAt')

    return await prisma.syncOutboxChange.create({
      data: {
        workspaceId: data.workspaceId,
        deviceId: data.deviceId,
        tableName: data.tableName,
        recordId: data.recordId,
        operation: data.operation,
        payload: data.payload,
        entityUpdatedAt,
        deletedAt:
          data.operation === SyncOperation.DELETE
            ? (parseDateOrNull(data.deletedAt) ?? new Date())
            : parseDateOrNull(data.deletedAt)
      }
    })
  }

  async getPendingOutboxChanges(data: PendingOutboxChangesDTO) {
    const prisma = getPrisma()

    return await prisma.syncOutboxChange.findMany({
      where: {
        workspaceId: data.workspaceId,
        deviceId: data.deviceId,
        ackedAt: null,
        ...(data.afterId && { id: { gt: data.afterId } })
      },
      orderBy: { id: 'asc' },
      take: clampLimit(data.limit)
    })
  }

  async acknowledgeOutboxChanges(data: AckOutboxChangesDTO) {
    const prisma = getPrisma()

    const where: Prisma.SyncOutboxChangeWhereInput = {
      workspaceId: data.workspaceId,
      deviceId: data.deviceId,
      ackedAt: null
    }

    if (data.changeIds?.length) {
      where.id = { in: data.changeIds }
    } else if (data.upToId !== undefined) {
      where.id = { lte: data.upToId }
    } else {
      throw new Error('Debes enviar changeIds o upToId para confirmar cambios')
    }

    const result = await prisma.syncOutboxChange.updateMany({
      where,
      data: {
        ackedAt: new Date()
      }
    })

    await prisma.syncState.upsert({
      where: {
        workspaceId_deviceId: {
          workspaceId: data.workspaceId,
          deviceId: data.deviceId
        }
      },
      create: {
        workspaceId: data.workspaceId,
        deviceId: data.deviceId,
        lastAckedChangeId: data.upToId ?? null,
        lastPushedAt: new Date()
      },
      update: {
        ...(data.upToId !== undefined && { lastAckedChangeId: data.upToId }),
        lastPushedAt: new Date()
      }
    })

    return {
      updated: result.count
    }
  }

  async ingestRemoteChanges(data: IngestRemoteChangesDTO) {
    const prisma = getPrisma()
    let inserted = 0
    let ignored = 0
    const invalidChanges: Array<{ remoteChangeId: string; reason: string }> = []
    const staleChanges: Array<{ remoteChangeId: string; reason: string }> = []

    const recordPairs = Array.from(
      new Set(data.changes.map((change) => `${change.tableName}::${change.recordId}`))
    ).map((pair) => {
      const [tableName, recordId] = pair.split('::')
      return { tableName, recordId }
    })

    const knownInboxByRecord = new Map<string, Date>()
    const knownOutboxByRecord = new Map<string, Date>()

    for (const pair of recordPairs) {
      const inboxLatest = await prisma.syncInboxChange.findFirst({
        where: {
          workspaceId: data.workspaceId,
          tableName: pair.tableName,
          recordId: pair.recordId,
          entityUpdatedAt: {
            not: null
          }
        },
        orderBy: [{ entityUpdatedAt: 'desc' }, { id: 'desc' }],
        select: {
          entityUpdatedAt: true
        }
      })

      const outboxLatest = await prisma.syncOutboxChange.findFirst({
        where: {
          workspaceId: data.workspaceId,
          tableName: pair.tableName,
          recordId: pair.recordId,
          entityUpdatedAt: {
            not: null
          }
        },
        orderBy: [{ entityUpdatedAt: 'desc' }, { id: 'desc' }],
        select: {
          entityUpdatedAt: true
        }
      })

      const key = `${pair.tableName}::${pair.recordId}`
      if (inboxLatest?.entityUpdatedAt) {
        knownInboxByRecord.set(key, inboxLatest.entityUpdatedAt)
      }
      if (outboxLatest?.entityUpdatedAt) {
        knownOutboxByRecord.set(key, outboxLatest.entityUpdatedAt)
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const change of data.changes) {
        const entityUpdatedAt = parseDateOrNull(change.entityUpdatedAt)
        if (!entityUpdatedAt) {
          invalidChanges.push({
            remoteChangeId: change.remoteChangeId,
            reason: 'entityUpdatedAt ausente o inválido'
          })
          continue
        }

        const recordKey = `${change.tableName}::${change.recordId}`
        const knownInboxDate = knownInboxByRecord.get(recordKey)
        const knownOutboxDate = knownOutboxByRecord.get(recordKey)

        if (isSameOrOlder(entityUpdatedAt, knownInboxDate)) {
          staleChanges.push({
            remoteChangeId: change.remoteChangeId,
            reason: 'Cambio remoto obsoleto: ya existe uno más reciente en inbox'
          })
          continue
        }

        if (isSameOrOlder(entityUpdatedAt, knownOutboxDate)) {
          staleChanges.push({
            remoteChangeId: change.remoteChangeId,
            reason: 'Cambio remoto obsoleto: existe cambio local más reciente en outbox'
          })
          continue
        }

        try {
          await tx.syncInboxChange.create({
            data: {
              workspaceId: data.workspaceId,
              sourceDeviceId: data.sourceDeviceId,
              remoteChangeId: change.remoteChangeId,
              tableName: change.tableName,
              recordId: change.recordId,
              operation: change.operation,
              payload: change.payload,
              entityUpdatedAt,
              deletedAt:
                change.operation === SyncOperation.DELETE
                  ? (parseDateOrNull(change.deletedAt) ?? new Date())
                  : parseDateOrNull(change.deletedAt)
            }
          })
          inserted += 1
          knownInboxByRecord.set(recordKey, entityUpdatedAt)
        } catch (error: unknown) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            ignored += 1
            continue
          }
          throw error
        }
      }
    })

    return {
      inserted,
      ignored,
      invalid: invalidChanges.length,
      stale: staleChanges.length,
      invalidChanges,
      staleChanges,
      total: data.changes.length
    }
  }

  async getPendingInboxChanges(data: PendingInboxChangesDTO) {
    const prisma = getPrisma()

    return await prisma.syncInboxChange.findMany({
      where: {
        workspaceId: data.workspaceId,
        appliedAt: null,
        ...(data.sourceDeviceId && { sourceDeviceId: data.sourceDeviceId }),
        ...(data.afterId && { id: { gt: data.afterId } })
      },
      orderBy: { id: 'asc' },
      take: clampLimit(data.limit)
    })
  }

  async markInboxChangesApplied(data: MarkInboxAppliedDTO) {
    const prisma = getPrisma()

    if (data.ids.length === 0) {
      return { updated: 0 }
    }

    const result = await prisma.syncInboxChange.updateMany({
      where: {
        workspaceId: data.workspaceId,
        id: { in: data.ids },
        appliedAt: null
      },
      data: {
        appliedAt: new Date()
      }
    })

    return {
      updated: result.count
    }
  }

  async applyPendingInboxBatch(data: ApplyPendingInboxBatchDTO) {
    const prisma = getPrisma()
    const pending = await prisma.syncInboxChange.findMany({
      where: {
        workspaceId: data.workspaceId,
        appliedAt: null,
        ...(data.sourceDeviceId && { sourceDeviceId: data.sourceDeviceId })
      },
      orderBy: { id: 'asc' },
      take: clampLimit(data.limit)
    })

    if (pending.length === 0) {
      return {
        total: 0,
        applied: 0,
        stale: 0,
        skipped: 0,
        failed: 0
      }
    }

    const appliedIds: number[] = []
    const stale: Array<{ inboxId: number; reason: string }> = []
    const skipped: Array<{ inboxId: number; reason: string }> = []
    const conflicts: Array<{ inboxId: number; reason: string }> = []
    const failed: Array<{ inboxId: number; reason: string }> = []

    await runWithoutSyncOutboxTracking(async () => {
      await prisma.$transaction(async (tx) => {
        for (const change of pending) {
          const definition = SYNC_TABLE_DEFINITIONS[change.tableName]
          if (!definition) {
            skipped.push({
              inboxId: change.id,
              reason: `Tabla no soportada en applyPendingInboxBatch: ${change.tableName}`
            })
            appliedIds.push(change.id)
            continue
          }

          if (!change.entityUpdatedAt) {
            skipped.push({
              inboxId: change.id,
              reason: 'Cambio sin entityUpdatedAt; no se aplica por seguridad'
            })
            appliedIds.push(change.id)
            continue
          }

          const incomingUpdatedAt = change.entityUpdatedAt

          const pendingLocalOutbox = await tx.syncOutboxChange.findFirst({
            where: {
              workspaceId: data.workspaceId,
              tableName: change.tableName,
              recordId: change.recordId,
              ackedAt: null
            },
            orderBy: [{ entityUpdatedAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              entityUpdatedAt: true
            }
          })

          if (pendingLocalOutbox) {
            conflicts.push({
              inboxId: change.id,
              reason:
                'Conflicto diferido: existe cambio local pendiente en outbox para el mismo registro'
            })
            continue
          }

          if (change.operation === SyncOperation.DELETE && !definition.allowDelete) {
            skipped.push({
              inboxId: change.id,
              reason: 'DELETE remoto bloqueado por política no destructiva'
            })
            appliedIds.push(change.id)
            continue
          }

          let payload: Record<string, unknown>
          try {
            payload = parsePayloadObject(change.payload, change.id)
          } catch (error: unknown) {
            failed.push({
              inboxId: change.id,
              reason: error instanceof Error ? error.message : 'Payload inválido'
            })
            continue
          }

          const where = definition.resolveWhere(change.recordId, payload)
          if (!where) {
            skipped.push({
              inboxId: change.id,
              reason: `No se pudo resolver clave única para ${change.tableName}`
            })
            appliedIds.push(change.id)
            continue
          }

          const delegate = (tx as Record<string, any>)[definition.delegateName]
          if (!delegate) {
            skipped.push({
              inboxId: change.id,
              reason: `Delegate Prisma no disponible: ${definition.delegateName}`
            })
            appliedIds.push(change.id)
            continue
          }

          try {
            const existing = await delegate.findUnique({
              where,
              select: { updatedAt: true }
            })

            if (existing?.updatedAt && isSameOrOlder(incomingUpdatedAt, existing.updatedAt)) {
              stale.push({
                inboxId: change.id,
                reason: 'Cambio remoto más antiguo o igual al registro local'
              })
              appliedIds.push(change.id)
              continue
            }

            if (change.operation === SyncOperation.DELETE) {
              if (!existing) {
                appliedIds.push(change.id)
                continue
              }

              await delegate.delete({ where })
              appliedIds.push(change.id)
              continue
            }

            const dataToWrite = pickAllowedFields(payload, definition.allowedFields)
            delete dataToWrite.updatedAt

            if (Object.keys(dataToWrite).length === 0) {
              skipped.push({
                inboxId: change.id,
                reason: 'Sin campos permitidos para aplicar el cambio'
              })
              appliedIds.push(change.id)
              continue
            }

            if (existing) {
              await delegate.update({ where, data: dataToWrite })
            } else {
              await delegate.create({ data: dataToWrite })
            }

            appliedIds.push(change.id)
          } catch (error: unknown) {
            failed.push({
              inboxId: change.id,
              reason: error instanceof Error ? error.message : 'Error aplicando cambio'
            })
          }
        }

        if (appliedIds.length > 0) {
          await tx.syncInboxChange.updateMany({
            where: {
              workspaceId: data.workspaceId,
              id: { in: appliedIds },
              appliedAt: null
            },
            data: {
              appliedAt: new Date()
            }
          })

          await tx.syncState.upsert({
            where: {
              workspaceId_deviceId: {
                workspaceId: data.workspaceId,
                deviceId: data.sourceDeviceId || 'local-merge-worker'
              }
            },
            create: {
              workspaceId: data.workspaceId,
              deviceId: data.sourceDeviceId || 'local-merge-worker',
              lastPulledAt: new Date()
            },
            update: {
              lastPulledAt: new Date()
            }
          })
        }
      })
    })

    return {
      total: pending.length,
      applied: appliedIds.length,
      stale: stale.length,
      skipped: skipped.length,
      conflicts: conflicts.length,
      failed: failed.length,
      staleChanges: stale,
      skippedChanges: skipped,
      conflictChanges: conflicts,
      failedChanges: failed
    }
  }
}

export default SyncService
