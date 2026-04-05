import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPrismaMock = vi.fn()

vi.mock('../../../electron/main/prisma', () => ({
  getPrisma: () => getPrismaMock()
}))

import { ScheduleService } from './schedule.service'

describe('ScheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateSchedule usa una sola mutacion anidada sin transaccion interactiva', async () => {
    const scheduleUpdateMock = vi.fn().mockResolvedValue({
      id: 1,
      items: []
    })

    getPrismaMock.mockReturnValue({
      schedule: {
        update: scheduleUpdateMock
      },
      $transaction: vi.fn()
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

    expect(scheduleUpdateMock).toHaveBeenCalledTimes(1)
    expect(scheduleUpdateMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        title: 'Culto Domingo',
        items: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: expect.any(Date) }
          },
          create: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              order: 1,
              type: 'SONG',
              accessData: '10',
              deletedAt: null
            },
            {
              id: '00000000-0000-4000-8000-000000000002',
              order: 2,
              type: 'MEDIA',
              accessData: '20',
              deletedAt: null
            }
          ]
        }
      },
      include: {
        items: { where: { deletedAt: null } }
      }
    })

    uuidSpy.mockRestore()
  })

  it('updateSchedule mantiene soft-delete aunque no reciba items nuevos', async () => {
    const scheduleUpdateMock = vi.fn().mockResolvedValue({ id: 2, items: [] })

    getPrismaMock.mockReturnValue({
      schedule: {
        update: scheduleUpdateMock
      }
    })

    const service = new ScheduleService()

    await service.updateSchedule(2, {
      title: 'Culto Miercoles'
    })

    const callArg = scheduleUpdateMock.mock.calls[0]?.[0]
    expect(callArg?.data?.items?.updateMany).toEqual({
      where: { deletedAt: null },
      data: { deletedAt: expect.any(Date) }
    })
    expect(callArg?.data?.items?.create).toEqual([])
  })
})
