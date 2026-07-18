import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OplogPurgeService } from './oplog-purge.service'
import type { OplogConfig } from './oplog.types'

const getPrismaMock = vi.fn()

vi.mock('../../prisma', () => ({
  getPrisma: () => getPrismaMock()
}))

const NOW = Date.now()
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()
const daysAgoDate = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000)

function makeEmptyModels() {
  const models: Record<string, { findMany: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }> = {}
  for (const name of ['ScheduleItem', 'Schedule', 'Song', 'TagSongs', 'Media', 'Themes', 'Font', 'Presentation', 'ScheduleGroupTemplate']) {
    models[name] = { findMany: vi.fn().mockResolvedValue([]), delete: vi.fn() }
  }
  return models
}

function makeConfig(overrides: Partial<OplogConfig> = {}): OplogConfig {
  return {
    deviceId: 'device-test-001',
    deviceName: 'test-pc',
    lastPushAt: daysAgo(0),
    lastPullAt: daysAgo(0),
    lastSyncAt: daysAgo(0),
    lastRemoteGeneration: 1,
    lastPurgeAt: null,
    ...overrides,
  }
}

describe('OplogPurgeService', () => {
  let service: OplogPurgeService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OplogPurgeService()
  })

  describe('isPurgeDue', () => {
    it('deberia retornar true si lastPurgeAt es null', () => {
      const config = makeConfig({ lastPurgeAt: null })
      expect(service.isPurgeDue(config)).toBe(true)
    })

    it('deberia retornar true si han pasado exactamente 24 horas', () => {
      const config = makeConfig({ lastPurgeAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString() })
      expect(service.isPurgeDue(config)).toBe(true)
    })

    it('deberia retornar true si han pasado mas de 24 horas', () => {
      const config = makeConfig({ lastPurgeAt: daysAgo(2) })
      expect(service.isPurgeDue(config)).toBe(true)
    })

    it('deberia retornar false si han pasado menos de 24 horas', () => {
      const config = makeConfig({ lastPurgeAt: daysAgo(0.5) })
      expect(service.isPurgeDue(config)).toBe(false)
    })

    it('deberia retornar false si han pasado 23 horas', () => {
      const config = makeConfig({ lastPurgeAt: new Date(NOW - 23 * 60 * 60 * 1000).toISOString() })
      expect(service.isPurgeDue(config)).toBe(false)
    })
  })

  describe('purgeSoftDeleted', () => {
    it('deberia retornar 0 si no hay registros soft-deleted', async () => {
      getPrismaMock.mockReturnValue(makeEmptyModels())

      const result = await service.purgeSoftDeleted(makeConfig())
      expect(result.totalPurged).toBe(0)
      expect(result.purged).toEqual({})
    })

    it('deberia purgar registros con deletedAt mayor a retention days', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn().mockResolvedValue(undefined)
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
        { id: 2, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete = deleteMock

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig())

      expect(result.totalPurged).toBe(2)
      expect(result.purged.song).toBe(2)
      expect(deleteMock).toHaveBeenCalledTimes(2)
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 2 } })
    })

    it('deberia respetar el orden de purge (ScheduleItem antes que Schedule)', async () => {
      const order: string[] = []
      const models = makeEmptyModels()

      for (const name of ['ScheduleItem', 'Schedule']) {
        models[name].findMany.mockImplementation(() => {
          order.push(`${name}.findMany`)
          return Promise.resolve([{ id: 1, deletedAt: daysAgoDate(60) }])
        })
        models[name].delete.mockImplementation(() => {
          order.push(`${name}.delete`)
          return Promise.resolve(undefined)
        })
      }

      getPrismaMock.mockReturnValue(models)
      await service.purgeSoftDeleted(makeConfig())

      const itemFindIdx = order.indexOf('ScheduleItem.findMany')
      const schedFindIdx = order.indexOf('Schedule.findMany')
      const itemDelIdx = order.indexOf('ScheduleItem.delete')
      const schedDelIdx = order.indexOf('Schedule.delete')

      expect(itemFindIdx).toBeLessThan(schedFindIdx)
      expect(itemDelIdx).toBeLessThan(schedDelIdx)
    })

    it('deberia iterar todas las 9 entidades con deletedAt', async () => {
      const models = makeEmptyModels()
      getPrismaMock.mockReturnValue(models)

      await service.purgeSoftDeleted(makeConfig())

      for (const name of Object.keys(models)) {
        expect(models[name].findMany).toHaveBeenCalledTimes(1)
      }
    })

    it('no deberia purgar registros con deletedAt dentro de retention', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn()
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(5) },
      ])
      models.Song.delete = deleteMock

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig(), 30)

      expect(result.totalPurged).toBe(0)
      expect(deleteMock).not.toHaveBeenCalled()
    })

    it('deberia aceptar retention personalizada de 7 dias', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn().mockResolvedValue(undefined)
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(10) },
        { id: 2, deletedAt: daysAgoDate(5) },
      ])
      models.Song.delete = deleteMock

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig(), 7)

      expect(result.totalPurged).toBe(1)
      expect(deleteMock).toHaveBeenCalledTimes(1)
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 1 } })
    })

    it('no deberia purgar si lastPushAt es anterior al deletedAt', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn()
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete = deleteMock

      const config = makeConfig({
        lastPushAt: daysAgo(90),
        lastPullAt: daysAgo(90),
      })

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(config, 30)

      expect(result.totalPurged).toBe(0)
      expect(deleteMock).not.toHaveBeenCalled()
    })

    it('no deberia purgar si lastPullAt es anterior al deletedAt', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn()
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete = deleteMock

      const config = makeConfig({
        lastPullAt: daysAgo(90),
      })

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(config, 30)

      expect(result.totalPurged).toBe(0)
      expect(deleteMock).not.toHaveBeenCalled()
    })

    it('deberia purgar si lastPushAt no esta definido', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn().mockResolvedValue(undefined)
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete = deleteMock

      const config = makeConfig({ lastPushAt: undefined, lastPullAt: undefined })

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(config, 30)

      expect(result.totalPurged).toBe(1)
    })

    it('deberia manejar errores P2025 (registro no encontrado) sin fallar', async () => {
      const models = makeEmptyModels()
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
        { id: 2, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete
        .mockRejectedValueOnce({ code: 'P2025' })
        .mockResolvedValueOnce(undefined)

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig())

      expect(result.totalPurged).toBe(1)
      expect(result.purged.song).toBe(1)
    })

    it('deberia continuar despues de error que no es P2025', async () => {
      const models = makeEmptyModels()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      models.Song.findMany.mockResolvedValue([
        { id: 1, deletedAt: daysAgoDate(60) },
        { id: 2, deletedAt: daysAgoDate(60) },
      ])
      models.Song.delete
        .mockRejectedValueOnce({ code: 'P2002', message: 'Unique constraint' })
        .mockResolvedValueOnce(undefined)

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig())

      expect(result.totalPurged).toBe(1)
      consoleSpy.mockRestore()
    })

    it('deberia procesar multiples lotes con cursor pagination', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn().mockResolvedValue(undefined)
      models.Song.delete = deleteMock

      const batch1 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        deletedAt: daysAgoDate(60),
      }))
      const batch2 = Array.from({ length: 10 }, (_, i) => ({
        id: i + 51,
        deletedAt: daysAgoDate(60),
      }))

      models.Song.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([])

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig())

      expect(result.totalPurged).toBe(60)
      expect(result.purged.song).toBe(60)
      expect(deleteMock).toHaveBeenCalledTimes(60)
      expect(models.Song.findMany).toHaveBeenCalledTimes(2)
    })

    it('deberia continuar procesando si primer lote no tiene elegibles', async () => {
      const models = makeEmptyModels()
      const deleteMock = vi.fn().mockResolvedValue(undefined)
      models.Song.delete = deleteMock

      const recentBatch = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        deletedAt: daysAgoDate(5),
      }))
      const oldBatch = Array.from({ length: 10 }, (_, i) => ({
        id: i + 51,
        deletedAt: daysAgoDate(60),
      }))

      models.Song.findMany
        .mockResolvedValueOnce(recentBatch)
        .mockResolvedValueOnce(oldBatch)
        .mockResolvedValueOnce([])

      getPrismaMock.mockReturnValue(models)
      const result = await service.purgeSoftDeleted(makeConfig(), 30)

      expect(result.totalPurged).toBe(10)
      expect(result.purged.song).toBe(10)
    })

    it('deberia ignorar modelos que no existen en Prisma', async () => {
      const prisma: any = {}
      getPrismaMock.mockReturnValue(prisma)

      const result = await service.purgeSoftDeleted(makeConfig())
      expect(result.totalPurged).toBe(0)
    })
  })
})
