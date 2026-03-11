import { Prisma, SyncOperation } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrismaMock = vi.fn()
const runWithoutSyncOutboxTrackingMock = vi.fn(async (fn: () => Promise<unknown>) => await fn())

vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: () => getPrismaMock(),
  runWithoutSyncOutboxTracking: (fn: () => Promise<unknown>) => runWithoutSyncOutboxTrackingMock(fn)
}))

import SyncService from './sync.service'

type SyncInboxChangeRecord = {
  id: number
  workspaceId: string
  sourceDeviceId: string
  remoteChangeId: string
  tableName: string
  recordId: string
  operation: SyncOperation
  payload: string
  entityUpdatedAt: Date | null
  deletedAt: Date | null
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function buildPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
    code,
    clientVersion: 'test'
  })
}

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza appendOutboxChange cuando entityUpdatedAt es inválido', async () => {
    getPrismaMock.mockReturnValue({
      syncOutboxChange: {
        create: vi.fn()
      }
    })

    const service = new SyncService()

    await expect(
      service.appendOutboxChange({
        workspaceId: 'ws-1',
        deviceId: 'pc-a',
        tableName: 'Song',
        recordId: '1',
        operation: SyncOperation.UPDATE,
        payload: JSON.stringify({ id: 1, title: 'Nuevo titulo' }),
        entityUpdatedAt: 'not-a-date'
      })
    ).rejects.toThrow('entityUpdatedAt es obligatorio y debe ser una fecha válida en formato ISO')
  })

  it('ingestRemoteChanges marca cambios inválidos y stale sin insertarlos', async () => {
    const createInboxMock = vi.fn()

    const prismaMock = {
      syncInboxChange: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ entityUpdatedAt: new Date('2026-03-09T11:00:00.000Z') })
          .mockResolvedValueOnce({ entityUpdatedAt: null }),
        create: createInboxMock
      },
      syncOutboxChange: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ entityUpdatedAt: null })
          .mockResolvedValueOnce({ entityUpdatedAt: new Date('2026-03-09T10:30:00.000Z') })
      },
      $transaction: vi.fn(
        async (handler: (tx: typeof prismaMock) => Promise<void>) => await handler(prismaMock)
      )
    }

    getPrismaMock.mockReturnValue(prismaMock)

    const service = new SyncService()
    const result = await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'r1',
          tableName: 'Song',
          recordId: '1',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 1, title: 'Old remote' }),
          entityUpdatedAt: '2026-03-09T10:00:00.000Z'
        },
        {
          remoteChangeId: 'r2',
          tableName: 'Theme',
          recordId: '2',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 2, name: 'Remote newer' }),
          entityUpdatedAt: 'invalid-date'
        }
      ]
    })

    expect(result.inserted).toBe(0)
    expect(result.invalid).toBe(1)
    expect(result.stale).toBe(1)
    expect(createInboxMock).not.toHaveBeenCalled()
  })

  it('ingestRemoteChanges ignora duplicados por P2002 y cuenta ignored', async () => {
    const prismaMock = {
      syncInboxChange: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(buildPrismaError('P2002'))
      },
      syncOutboxChange: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      $transaction: vi.fn(
        async (handler: (tx: typeof prismaMock) => Promise<void>) => await handler(prismaMock)
      )
    }

    getPrismaMock.mockReturnValue(prismaMock)

    const service = new SyncService()
    const result = await service.ingestRemoteChanges({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      changes: [
        {
          remoteChangeId: 'dup-1',
          tableName: 'Song',
          recordId: '3',
          operation: SyncOperation.UPDATE,
          payload: JSON.stringify({ id: 3, title: 'Duplicate' }),
          entityUpdatedAt: '2026-03-09T12:00:00.000Z'
        }
      ]
    })

    expect(result.ignored).toBe(1)
    expect(result.inserted).toBe(0)
    expect(result.invalid).toBe(0)
    expect(result.stale).toBe(0)
  })

  it('applyPendingInboxBatch difiere cambios cuando existe conflicto local pendiente', async () => {
    const inboxRows: SyncInboxChangeRecord[] = [
      {
        id: 10,
        workspaceId: 'ws-1',
        sourceDeviceId: 'pc-b',
        remoteChangeId: 'r-10',
        tableName: 'Song',
        recordId: '1',
        operation: SyncOperation.UPDATE,
        payload: JSON.stringify({ id: 1, title: 'Remote title' }),
        entityUpdatedAt: new Date('2026-03-09T13:00:00.000Z'),
        deletedAt: null,
        appliedAt: null,
        createdAt: new Date('2026-03-09T13:01:00.000Z'),
        updatedAt: new Date('2026-03-09T13:01:00.000Z')
      }
    ]

    const updateManyMock = vi.fn()
    const upsertStateMock = vi.fn()

    const txMock = {
      syncOutboxChange: {
        findFirst: vi.fn().mockResolvedValue({
          id: 77,
          entityUpdatedAt: new Date('2026-03-09T13:05:00.000Z')
        })
      },
      syncInboxChange: {
        updateMany: updateManyMock
      },
      syncState: {
        upsert: upsertStateMock
      }
    }

    const prismaMock = {
      syncInboxChange: {
        findMany: vi.fn().mockResolvedValue(inboxRows)
      },
      $transaction: vi.fn(
        async (handler: (tx: typeof txMock) => Promise<void>) => await handler(txMock)
      )
    }

    getPrismaMock.mockReturnValue(prismaMock)

    const service = new SyncService()
    const result = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      limit: 50
    })

    expect(result.total).toBe(1)
    expect(result.skipped).toBe(1)
    // applied cuenta los ids marcados como applied (incluye skipped que se marcan como applied)
    expect(result.applied).toBe(1)
    expect(updateManyMock).toHaveBeenCalled()
    expect(upsertStateMock).toHaveBeenCalled()
  })

  it('applyPendingInboxBatch aplica update remoto y marca appliedAt + syncState', async () => {
    const inboxRows: SyncInboxChangeRecord[] = [
      {
        id: 11,
        workspaceId: 'ws-1',
        sourceDeviceId: 'pc-b',
        remoteChangeId: 'r-11',
        tableName: 'Song',
        recordId: '1',
        operation: SyncOperation.UPDATE,
        payload: JSON.stringify({
          id: 1,
          title: 'Titulo remoto',
          updatedAt: '2020-01-01T00:00:00.000Z'
        }),
        entityUpdatedAt: new Date('2026-03-09T14:00:00.000Z'),
        deletedAt: null,
        appliedAt: null,
        createdAt: new Date('2026-03-09T14:01:00.000Z'),
        updatedAt: new Date('2026-03-09T14:01:00.000Z')
      }
    ]

    const updateSongMock = vi.fn()
    const updateManyInboxMock = vi.fn()
    const upsertStateMock = vi.fn()

    const txMock = {
      syncOutboxChange: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      song: {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date('2026-03-09T13:00:00.000Z') }),
        update: updateSongMock,
        create: vi.fn(),
        delete: vi.fn()
      },
      syncInboxChange: {
        updateMany: updateManyInboxMock
      },
      syncState: {
        upsert: upsertStateMock
      }
    }

    const prismaMock = {
      syncInboxChange: {
        findMany: vi.fn().mockResolvedValue(inboxRows)
      },
      $transaction: vi.fn(
        async (handler: (tx: typeof txMock) => Promise<void>) => await handler(txMock)
      )
    }

    getPrismaMock.mockReturnValue(prismaMock)

    const service = new SyncService()
    const result = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b',
      limit: 100
    })

    expect(result.applied).toBe(1)
    expect(result.failed).toBe(0)
    expect(updateSongMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { id: 1, title: 'Titulo remoto' }
    })
    expect(updateManyInboxMock).toHaveBeenCalledTimes(1)
    expect(upsertStateMock).toHaveBeenCalledTimes(1)
    expect(runWithoutSyncOutboxTrackingMock).toHaveBeenCalledTimes(1)
  })

  it('applyPendingInboxBatch ignora payload inválido y no marca cambio como aplicado', async () => {
    const inboxRows: SyncInboxChangeRecord[] = [
      {
        id: 12,
        workspaceId: 'ws-1',
        sourceDeviceId: 'pc-b',
        remoteChangeId: 'r-12',
        tableName: 'Song',
        recordId: '1',
        operation: SyncOperation.UPDATE,
        payload: '{bad json}',
        entityUpdatedAt: new Date('2026-03-09T15:00:00.000Z'),
        deletedAt: null,
        appliedAt: null,
        createdAt: new Date('2026-03-09T15:01:00.000Z'),
        updatedAt: new Date('2026-03-09T15:01:00.000Z')
      }
    ]

    const updateManyInboxMock = vi.fn()

    const txMock = {
      syncOutboxChange: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      song: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
      },
      syncInboxChange: {
        updateMany: updateManyInboxMock
      },
      syncState: {
        upsert: vi.fn()
      }
    }

    const prismaMock = {
      syncInboxChange: {
        findMany: vi.fn().mockResolvedValue(inboxRows)
      },
      $transaction: vi.fn(
        async (handler: (tx: typeof txMock) => Promise<void>) => await handler(txMock)
      )
    }

    getPrismaMock.mockReturnValue(prismaMock)

    const service = new SyncService()
    const result = await service.applyPendingInboxBatch({
      workspaceId: 'ws-1',
      sourceDeviceId: 'pc-b'
    })

    expect(result.failed).toBe(1)
    expect(result.applied).toBe(0)
    expect(updateManyInboxMock).not.toHaveBeenCalled()
  })
})
