import { AddScheduleItemDto } from './schedule.dto'
import { ScheduleService } from './schedule.service'

export class ScheduleController {
  private scheduleService = new ScheduleService()

  getActualSchedule() {
    return this.scheduleService.getActualSchedule()
  }

  createSchedule(name: string, dateFrom?: Date, dateTo?: Date) {
    return this.scheduleService.createNewSchedule(name, dateFrom, dateTo)
  }

  getAllSchedules() {
    return this.scheduleService.getAllSchedules()
  }

  getSchedule(id: number) {
    return this.scheduleService.getSchedule(id)
  }

  updateSchedule(id: number, data: { title?: string; date?: Date }) {
    return this.scheduleService.updateSchedule(id, data)
  }

  deleteSchedule(id: number) {
    return this.scheduleService.deleteSchedule(id)
  }

  addItemToSchedule(scheduleId: number, itemData: AddScheduleItemDto) {
    return this.scheduleService.addItemToSchedule(scheduleId, itemData)
  }

  deleteItemFromSchedule(scheduleId: number, itemId: number[]) {
    return this.scheduleService.deleteItemFromSchedule(scheduleId, itemId)
  }
}
