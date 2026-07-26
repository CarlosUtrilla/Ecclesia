import { getPrisma } from '../../prisma'
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
  async createNewSchedule(name: string, dateFrom?: Date, dateTo?: Date, items?: AddScheduleItemDto[]) {
    const schedule = await this.prisma.schedule.create({
      data: { title: name, dateFrom, dateTo }
    })

    // Create items individually — createMany returns { count } not rows,
    // so the oplog middleware cannot generate events from it.
    for (const item of items ?? []) {
      await this.prisma.scheduleItem.create({
        data: { ...item, id: crypto.randomUUID(), scheduleId: schedule.id }
      })
    }

    return this.prisma.schedule.findFirst({
      where: { id: schedule.id, deletedAt: null },
      include: { items: { where: { deletedAt: null } } }
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

  async updateSchedule(id: number, data: UpdateScheduleDto) {
    const { items, ...rest } = data

    // Soft-delete existing items (top-level op so oplog middleware captures it)
    await this.prisma.scheduleItem.updateMany({
      where: { scheduleId: id, deletedAt: null },
      data: { deletedAt: new Date() }
    })

    // Create items individually — createMany returns { count } not rows,
    // so the oplog middleware cannot generate events from it.
    for (const item of items ?? []) {
      await this.prisma.scheduleItem.create({
        data: { ...item, id: crypto.randomUUID(), scheduleId: id }
      })
    }

    // Update schedule metadata
    return this.prisma.schedule.update({
      where: { id },
      data: rest,
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
    // Top-level create so oplog middleware captures the ScheduleItem event
    await this.prisma.scheduleItem.create({
      data: {
        ...itemData,
        id: crypto.randomUUID(),
        scheduleId
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
