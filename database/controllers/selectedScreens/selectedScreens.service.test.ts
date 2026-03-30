import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectedScreensService from './selectedScreens.service'

const prismaMock = {
  selectedScreens: {
    upsert: vi.fn(),
    findUnique: vi.fn()
  }
}

vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: () => prismaMock
}))

describe('SelectedScreensService', () => {
  let service: SelectedScreensService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SelectedScreensService()
  })

  it('deberia crear de forma idempotente por screenId usando upsert', async () => {
    prismaMock.selectedScreens.upsert.mockResolvedValue({
      id: 1,
      screenId: BigInt(2001),
      screenName: 'Display 1',
      rol: 'LIVE_SCREEN',
      updatedAt: new Date()
    })

    const result = await service.createSelectedScreen({
      screenId: 2001,
      screenName: 'Display 1',
      rol: 'LIVE_SCREEN'
    })

    expect(prismaMock.selectedScreens.upsert).toHaveBeenCalledWith({
      where: { screenId: BigInt(2001) },
      create: { screenId: BigInt(2001), screenName: 'Display 1', rol: 'LIVE_SCREEN' },
      update: { screenName: 'Display 1', rol: 'LIVE_SCREEN' }
    })
    expect(result.screenId).toBe(2001)
  })

  it('deberia mapear screenId bigint a number al consultar por id', async () => {
    prismaMock.selectedScreens.findUnique.mockResolvedValue({
      id: 3,
      screenId: BigInt(999),
      screenName: 'Stage',
      rol: 'STAGE_SCREEN',
      updatedAt: new Date()
    })

    const result = await service.getSelectedScreenById(3)
    expect(result?.screenId).toBe(999)
  })
})
