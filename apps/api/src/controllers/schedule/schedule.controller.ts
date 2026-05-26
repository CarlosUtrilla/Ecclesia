import { RequestHandler } from '../../utils/RequestHandler'
import { ScheduleGroupTemplateService } from './schedule-group.service'
import { AddScheduleItemDto, CreateScheduleBody, UpdateScheduleDto } from './schedule.dto'
import { ScheduleService } from './schedule.service'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export class ScheduleController {
  private scheduleService = new ScheduleService()
  private scheduleTemplateService = new ScheduleGroupTemplateService()

  getActualSchedule() {
    return this.scheduleService.getActualSchedule()
  }

  createSchedule({ body }: RequestHandler<CreateScheduleBody>) {
    return this.scheduleService.createNewSchedule(body.name, body.dateFrom, body.dateTo, body.items)
  }

  getAllSchedules() {
    return this.scheduleService.getAllSchedules()
  }

  getSchedule({ body }: RequestHandler<{ id: number }>) {
    return this.scheduleService.getSchedule(body.id)
  }

  updateSchedule({ body }: RequestHandler<{ id: number; data: UpdateScheduleDto }>) {
    return this.scheduleService.updateSchedule(body.id, body.data)
  }

  deleteSchedule({ body }: RequestHandler<{ id: number }>) {
    return this.scheduleService.deleteSchedule(body.id)
  }

  addItemToSchedule({
    body
  }: RequestHandler<{ scheduleId: number; itemData: AddScheduleItemDto }>) {
    return this.scheduleService.addItemToSchedule(body.scheduleId, body.itemData)
  }

  deleteItemFromSchedule({ body }: RequestHandler<{ scheduleId: number; itemId: number[] }>) {
    return this.scheduleService.deleteItemFromSchedule(body.scheduleId, body.itemId)
  }

  @UpdateQueryKey(['scheduleGroupTemplates'])
  async createGroupTemplate({ body }: RequestHandler<{ name: string; color: string }>) {
    return await this.scheduleTemplateService.createGroupTemplate(body)
  }

  // Obtener todos los templates de grupos
  async getAllGroupTemplates() {
    return await this.scheduleTemplateService.getAllGroupTemplates()
  }

  // Obtener un template por ID
  async getGroupTemplateById({ body }: RequestHandler<{ id: number }>) {
    return await this.scheduleTemplateService.getGroupTemplateById(body.id)
  }

  // Actualizar un template de grupo
  @UpdateQueryKey(['scheduleGroupTemplates'])
  async updateGroupTemplate({
    body
  }: RequestHandler<{ id: number; data: { name?: string; color?: string } }>) {
    return await this.scheduleTemplateService.updateGroupTemplate(body.id, body.data)
  }

  // Eliminar un template de grupo
  @UpdateQueryKey(['scheduleGroupTemplates'])
  async deleteGroupTemplate({ body }: RequestHandler<{ id: number }>) {
    return await this.scheduleTemplateService.deleteGroupTemplate(body.id)
  }
}
