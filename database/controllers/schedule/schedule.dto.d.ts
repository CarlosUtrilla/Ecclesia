export type UpdateScheduleDto = {
  title?: string
  date?: Date
  items?: AddScheduleItemDto[]
}
import { Schedule, ScheduleItem, ScheduleGroupTemplate } from '@prisma/client'

export type CreateScheduleDto = Omit<Schedule, 'id'> & {
  items?: AddScheduleItemDto[]
}

export type ScheduleWithItems = Omit<Schedule, 'id'> & {
  items: ScheduleItem[]
  id?: number
}

export type AddScheduleItemDto = Omit<ScheduleItem, 'id' | 'scheduleId'>

export type ScheduleGroupTemplateDTO = ScheduleGroupTemplate
