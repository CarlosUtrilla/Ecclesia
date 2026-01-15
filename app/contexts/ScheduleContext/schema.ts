import z from 'zod'

export const ScheduleSchema = z.object({
  id: z.number().nullable(),
  title: z.string().min(1, 'El título es obligatorio'),
  items: z.array(z.any()),
  dateFrom: z.date().nullable(),
  dateTo: z.date().nullable()
})
