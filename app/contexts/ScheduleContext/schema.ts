import { ScheduleItem } from '@prisma/client'
import z from 'zod'

export const ScheduleSchema = z.object({
  id: z.number().nullable(),
  title: z.string().min(1, 'El título es obligatorio'),
  items: z.custom<ScheduleItem[]>(),
  dateFrom: z.date().nullable(),
  dateTo: z.date().nullable()
})

export type ScheduleSchemaType = z.infer<typeof ScheduleSchema>
