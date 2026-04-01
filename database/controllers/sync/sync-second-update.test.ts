import { describe, it, expect, beforeEach, vi } from 'vitest'
import SyncService from './sync.service'
import { getPrisma } from '../../../electron/main/prisma'

// Mock de Prisma
vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: vi.fn(),
  runWithoutSyncOutboxTracking: vi.fn(async (fn) => fn())
}))

describe('SyncService - Second Update After Remote Sync', () => {
  let syncService: SyncService
  let prismaMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock = {
      presentation: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn()
      },
      syncState: {
        upsert: vi.fn()
      },
      $transaction: vi.fn(async (fn) => fn(prismaMock))
    }
    vi.mocked(getPrisma).mockReturnValue(prismaMock)
    syncService = new SyncService()
  })

  it('debería permitir ediciones locales posteriores después de aplicar snapshot remoto', async () => {
    const workspaceId = 'ws-123'
    const deviceAId = 'device-a'

    const t1 = new Date('2024-03-29T10:00:00Z')
    const t3 = new Date('2024-03-29T10:10:00Z')

    const remoteSnapshot = {
      Presentation: [
        {
          id: 1,
          title: 'Presentation Original',
          slides: JSON.stringify([{ id: 1, content: 'slide 1' }]),
          updatedAt: t1.toISOString()
        }
      ]
    }

    prismaMock.presentation.findFirst.mockResolvedValue(null)
    prismaMock.presentation.create.mockResolvedValue({
      id: 1,
      title: 'Presentation Original',
      slides: JSON.stringify([{ id: 1, content: 'slide 1' }]),
      updatedAt: t3
    })

    const applyResult = await syncService.applySnapshotRows(remoteSnapshot, workspaceId, deviceAId)

    expect(applyResult.applied).toBe(1)
    expect(applyResult.stale).toBe(0)
    expect(prismaMock.syncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_deviceId: {
            workspaceId,
            deviceId: deviceAId
          }
        }
      })
    )
  })

  it('debería evitar el ping-pong de timestamps sin restaurar updatedAt', async () => {
    const workspaceId = 'ws-123'
    const remoteDeviceId = 'device-remote'

    const snapshot = {
      Presentation: [
        {
          id: 1,
          title: 'Test',
          slides: '[]',
          updatedAt: new Date('2024-03-29T10:00:00Z').toISOString()
        }
      ]
    }

    prismaMock.presentation.findFirst.mockResolvedValue(null)
    prismaMock.presentation.create.mockResolvedValue({
      id: 1,
      title: 'Test',
      slides: '[]',
      updatedAt: new Date()
    })

    const result = await syncService.applySnapshotRows(snapshot, workspaceId, remoteDeviceId)

    expect(result.applied).toBe(1)
    expect(prismaMock.presentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Test',
          slides: '[]',
          updatedAt: new Date('2024-03-29T10:00:00Z')
        })
      })
    )
  })

  it('debería aplicar una segunda edición remota aunque el reloj local esté adelantado', async () => {
    const workspaceId = 'ws-123'
    const remoteDeviceId = 'device-a'

    prismaMock.presentation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, updatedAt: new Date('2024-03-29T10:00:00Z') })

    prismaMock.presentation.create.mockResolvedValueOnce({
      id: 1,
      title: 'Version 1',
      slides: JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))),
      updatedAt: new Date('2024-03-29T10:00:00Z')
    })

    prismaMock.presentation.update.mockResolvedValueOnce({
      id: 1,
      title: 'Version 2',
      slides: JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }))),
      updatedAt: new Date('2024-03-29T10:05:00Z')
    })

    const snapshotV1 = {
      Presentation: [
        {
          id: 1,
          title: 'Version 1',
          slides: JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }))),
          updatedAt: new Date('2024-03-29T10:00:00Z').toISOString()
        }
      ]
    }

    const snapshotV2 = {
      Presentation: [
        {
          id: 1,
          title: 'Version 2',
          slides: JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }))),
          updatedAt: new Date('2024-03-29T10:05:00Z').toISOString()
        }
      ]
    }

    const firstApply = await syncService.applySnapshotRows(snapshotV1, workspaceId, remoteDeviceId)
    expect(firstApply.applied).toBe(1)

    // Al preservar updatedAt remoto en el primer apply (10:00), la segunda edición
    // remota (10:05) no cae como stale y se aplica correctamente.
    const secondApply = await syncService.applySnapshotRows(snapshotV2, workspaceId, remoteDeviceId)
    expect(secondApply.applied).toBe(1)
    expect(secondApply.stale).toBe(0)

    expect(prismaMock.presentation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          title: 'Version 2',
          updatedAt: new Date('2024-03-29T10:05:00Z')
        })
      })
    )
  })
})
