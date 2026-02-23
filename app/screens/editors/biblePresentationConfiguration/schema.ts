import { BibleDescriptionMode, BibleDescriptionPosition } from '@prisma/client'
import z from 'zod'

export const BiblePresentationSchema = z.object({
  id: z.number().optional(),
  description: z.union(Object.values(BibleDescriptionMode).map((mode) => z.literal(mode))),
  position: z.union(Object.values(BibleDescriptionPosition).map((mode) => z.literal(mode))),
  showVersion: z.boolean(),
  showVerseNumber: z.boolean(),
  positionStyle: z.number().nullable()
})
