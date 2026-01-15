import { Schedule, ScheduleItem } from '@prisma/client'

export type CreateScheduleDto = Omit<Schedule, 'id'>

export type ScheduleWithItems = Schedule & {
  items: ScheduleItem[]
}

export type AddScheduleItemDto = Omit<ScheduleItem, 'id' | 'scheduleId'>
