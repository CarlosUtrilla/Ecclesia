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
  createNewSchedule(name: string, dateFrom?: Date, dateTo?: Date) {
    return this.prisma.schedule.create({
      data: {
        title: name,
        dateFrom,
        dateTo
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
    return this.prisma.schedule.findMany({})
  }

  updateSchedule(id: number, data: { title?: string; date?: Date }) {
    return this.prisma.schedule.update({
      where: { id },
      data
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
          create: itemData
        }
      }
    })
  }

  async deleteItemFromSchedule(scheduleId: number, itemId: number[]) {
    // Eliminar los items especificados
    await this.prisma.scheduleItem.deleteMany({
      where: {
        id: {
          in: itemId
        }
      }
    })
  }
}
