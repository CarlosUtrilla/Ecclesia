import { getPrisma } from '../../../electron/main/prisma'
import { AddScheduleItemDto, ScheduleWithItems } from './schedule.dto'

export class ScheduleService {
  prisma = getPrisma()

  async getActualSchedule(): Promise<ScheduleWithItems | null> {
    const today = new Date()
    return await this.prisma.schedule.findFirst({
      where: {
        dateFrom: {
          lte: today
        },
        dateTo: {
          gte: today
        }
      },
      include: {
        items: true
      }
    })
  }
  createNewSchedule(name: string, dateFrom?: Date, dateTo?: Date, items?: AddScheduleItemDto[]) {
    return this.prisma.schedule.create({
      data: {
        title: name,
        dateFrom,
        dateTo,
        items:
          items && items.length > 0
            ? {
                create: items.map((item) => {
                  const { scheduleId, ...rest } = item
                  return {
                    ...rest,
                    id: crypto.randomUUID()
                  }
                })
              }
            : undefined
      },
      include: {
        items: true
      }
    })
  }

  getSchedule(id: number) {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: {
        items: true
      }
    })
  }

  getAllSchedules() {
    return this.prisma.schedule.findMany({
      include: {
        items: true
      }
    })
  }

  updateSchedule(id: number, data: { title?: string; date?: Date; items?: AddScheduleItemDto[] }) {
    const { items, ...rest } = data
    return this.prisma.$transaction(async (prisma) => {
      // Eliminar todos los items actuales del schedule
      await prisma.scheduleItem.deleteMany({ where: { scheduleId: id } })
      // Actualizar el schedule y crear los nuevos items
      return prisma.schedule.update({
        where: { id },
        data: {
          ...rest,
          items:
            items && items.length > 0
              ? {
                  create: items.map((item) => {
                    const { scheduleId, ...rest } = item
                    return {
                      ...rest,
                      id: crypto.randomUUID()
                    }
                  })
                }
              : undefined
        },
        include: {
          items: true
        }
      })
    })
  }

  deleteSchedule(id: number) {
    return this.prisma.schedule.delete({
      where: { id }
    })
  }

  async addItemToSchedule(scheduleId: number, itemData: AddScheduleItemDto) {
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        items: {
          create: (() => {
            const { scheduleId, ...rest } = itemData
            return {
              ...rest,
              id: crypto.randomUUID()
            }
          })()
        }
      }
    })
  }

  async deleteItemFromSchedule(_scheduleId: number, itemId: number[]) {
    // Eliminar los items especificados
    await this.prisma.scheduleItem.deleteMany({
      where: {
        id: {
          in: itemId.map(String)
        }
      }
    })
  }
}
