import { getPrisma } from '../../../electron/main/prisma'
import { AddScheduleItemDto, ScheduleWithItems, UpdateScheduleDto } from './schedule.dto'

export class ScheduleService {
  prisma = getPrisma()

  async getActualSchedule(): Promise<ScheduleWithItems | null> {
    const today = new Date()
    return await this.prisma.schedule.findFirst({
      where: {
        deletedAt: null,
        dateFrom: {
          lte: today
        },
        dateTo: {
          gte: today
        }
      },
      include: {
        items: { where: { deletedAt: null } }
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
                create: items.map((item) => ({ ...item, id: crypto.randomUUID() }))
              }
            : undefined
      },
      include: {
        items: { where: { deletedAt: null } }
      }
    })
  }

  getSchedule(id: number) {
    return this.prisma.schedule.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { where: { deletedAt: null } }
      }
    })
  }

  getAllSchedules() {
    return this.prisma.schedule.findMany({
      where: { deletedAt: null },
      include: {
        items: { where: { deletedAt: null } }
      }
    })
  }

  updateSchedule(id: number, data: UpdateScheduleDto) {
    const { items, ...rest } = data
    return this.prisma.schedule.update({
      where: { id },
      data: {
        ...rest,
        items: {
          updateMany: {
            where: { deletedAt: null },
            data: { deletedAt: new Date() }
          },
          create: (items ?? []).map((item) => ({ ...item, id: crypto.randomUUID() }))
        }
      },
      include: {
        items: { where: { deletedAt: null } }
      }
    })
  }

  deleteSchedule(id: number) {
    return this.prisma.schedule.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  async addItemToSchedule(scheduleId: number, itemData: AddScheduleItemDto) {
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        items: {
          create: {
            ...itemData,
            id: crypto.randomUUID()
          }
        }
      }
    })
  }

  async deleteItemFromSchedule(_scheduleId: number, itemId: number[]) {
    // Soft-delete los items especificados
    await this.prisma.scheduleItem.updateMany({
      where: {
        id: {
          in: itemId.map(String)
        }
      },
      data: { deletedAt: new Date() }
    })
  }
}
