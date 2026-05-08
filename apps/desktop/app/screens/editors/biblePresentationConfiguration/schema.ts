import type { BibleDescriptionMode, BibleDescriptionPosition } from '@ecclesia/api'
import z from 'zod'

export const BiblePresentationSchema = z.object({
  id: z.number().optional(),
  description: z.enum(['short', 'complete'] as [BibleDescriptionMode, BibleDescriptionMode]),
  position: z.enum(
    ['beforeText', 'afterText', 'underText', 'overText', 'upScreen', 'downScreen'] as [
      BibleDescriptionPosition,
      ...BibleDescriptionPosition[]
    ]
  ),

  showVersion: z.boolean(),
  showVerseNumber: z.boolean(),
  positionStyle: z.number().nullable()
})
