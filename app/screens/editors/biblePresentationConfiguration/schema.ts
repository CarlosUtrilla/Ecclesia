import type { BibleDescriptionMode, BibleDescriptionPosition } from '@prisma/client'
import z from 'zod'

export const BiblePresentationSchema = z.object({
  id: z.number().optional(),
  description: z.enum(['short', 'complete'] as [BibleDescriptionMode, BibleDescriptionMode]),
  position: z.enum(['beforeText', 'afterText', 'underText', 'overText', 'upScreen'] as [BibleDescriptionPosition, ...BibleDescriptionPosition[]]),

  showVersion: z.boolean(),
  showVerseNumber: z.boolean(),
  positionStyle: z.number().nullable()
})
