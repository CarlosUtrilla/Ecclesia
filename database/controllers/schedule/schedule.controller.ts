import { ScheduleGroupTemplateService } from './schedule-group.service'
import { AddScheduleItemDto } from './schedule.dto'
import { ScheduleService } from './schedule.service'

export class ScheduleController {
  private scheduleService = new ScheduleService()
  private scheduleTemplateService = new ScheduleGroupTemplateService()

  getActualSchedule() {
    return this.scheduleService.getActualSchedule()
  }

  createSchedule(name: string, dateFrom?: Date, dateTo?: Date, items?: AddScheduleItemDto[]) {
    return this.scheduleService.createNewSchedule(name, dateFrom, dateTo, items)
  }

  getAllSchedules() {
    return this.scheduleService.getAllSchedules()
  }

  getSchedule(id: number) {
    return this.scheduleService.getSchedule(id)
  }

  updateSchedule(id: number, data: { title?: string; date?: Date; items?: AddScheduleItemDto[] }) {
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

  async createGroupTemplate(data: { name: string; color: string }) {
    return await this.scheduleTemplateService.createGroupTemplate(data)
  }

  // Obtener todos los templates de grupos
  async getAllGroupTemplates() {
    return await this.scheduleTemplateService.getAllGroupTemplates()
  }

  // Obtener un template por ID
  async getGroupTemplateById(id: number) {
    return await this.scheduleTemplateService.getGroupTemplateById(id)
  }

  // Actualizar un template de grupo
  async updateGroupTemplate(id: number, data: { name?: string; color?: string }) {
    return await this.scheduleTemplateService.updateGroupTemplate(id, data)
  }

  // Eliminar un template de grupo
  async deleteGroupTemplate(id: number) {
    return await this.scheduleTemplateService.deleteGroupTemplate(id)
  }
}
