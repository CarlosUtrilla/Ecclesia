import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrismaMock = vi.fn()

vi.mock('../../prisma', () => ({
  getPrisma: () => getPrismaMock()
}))

import { ScheduleService } from './schedule.service'

describe('ScheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateSchedule usa create individual por item para que el middleware oplog genere eventos', async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 3 })
    const createMock = vi.fn().mockResolvedValue({})
    const scheduleUpdateMock = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Culto Domingo',
      items: []
    })

    getPrismaMock.mockReturnValue({
      scheduleItem: {
        updateMany: updateManyMock,
        create: createMock
      },
      schedule: {
        update: scheduleUpdateMock
      }
    })

    const uuidSpy = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')

    const service = new ScheduleService()

    await service.updateSchedule(1, {
      title: 'Culto Domingo',
      items: [
        { order: 1, type: 'SONG', accessData: '10', deletedAt: null },
        { order: 2, type: 'MEDIA', accessData: '20', deletedAt: null }
      ]
    })

    // 1) Soft-delete existing items via top-level updateMany
    expect(updateManyMock).toHaveBeenCalledTimes(1)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { scheduleId: 1, deletedAt: null },
      data: { deletedAt: expect.any(Date) }
    })

    // 2) Create each item individually (createMany would not generate oplog events)
    expect(createMock).toHaveBeenCalledTimes(2)
    expect(createMock).toHaveBeenNthCalledWith(1, {
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        order: 1,
        type: 'SONG',
        accessData: '10',
        deletedAt: null,
        scheduleId: 1
      }
    })
    expect(createMock).toHaveBeenNthCalledWith(2, {
      data: {
        id: '00000000-0000-4000-8000-000000000002',
        order: 2,
        type: 'MEDIA',
        accessData: '20',
        deletedAt: null,
        scheduleId: 1
      }
    })

    // 3) Update schedule metadata
    expect(scheduleUpdateMock).toHaveBeenCalledTimes(1)
    expect(scheduleUpdateMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { title: 'Culto Domingo' },
      include: { items: { where: { deletedAt: null } } }
    })

    uuidSpy.mockRestore()
  })

  it('updateSchedule soft-delete items aunque no reciba items nuevos', async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 2 })
    const createMock = vi.fn()
    const scheduleUpdateMock = vi.fn().mockResolvedValue({ id: 2, items: [] })

    getPrismaMock.mockReturnValue({
      scheduleItem: {
        updateMany: updateManyMock,
        create: createMock
      },
      schedule: {
        update: scheduleUpdateMock
      }
    })

    const service = new ScheduleService()

    await service.updateSchedule(2, {
      title: 'Culto Miercoles'
    })

    // Soft-delete still runs
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { scheduleId: 2, deletedAt: null },
      data: { deletedAt: expect.any(Date) }
    })

    // No create calls since items is undefined
    expect(createMock).not.toHaveBeenCalled()

    // Schedule update still runs with title
    expect(scheduleUpdateMock).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { title: 'Culto Miercoles' },
      include: { items: { where: { deletedAt: null } } }
    })
  })
})
