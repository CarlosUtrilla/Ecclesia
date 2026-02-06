import { Schedule, ScheduleItem, ScheduleGroupTemplate, ScheduleGroup } from '@prisma/client'

export type CreateScheduleDto = Omit<Schedule, 'id'>

export type ScheduleWithItems = Omit<Schedule, 'id'> & {
  items: ScheduleItem[]
  id?: number
}

export type AddScheduleItemDto = Omit<ScheduleItem, 'id' | 'scheduleId'>

export type ScheduleGroupTemplateDTO = ScheduleGroupTemplate & {
  scheduleGroups: ScheduleGroup[]
}
