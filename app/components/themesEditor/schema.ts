import { BibleDescriptionMode, BibleDescriptionPosition } from '@prisma/client'
import { z } from 'zod'
export const CreateThemeSchema = z.object({
  name: z.string().min(1, 'El nombre del tema es obligatorio'),
  background: z.string(),
  backgroundMediaId: z.number().nullable(),
  textColor: z.string(),
  textSize: z.number(),
  animationSettings: z.string(),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
  fontFamily: z.string(),
  lineHeight: z.number(),
  letterSpacing: z.number(),
  textAlign: z.string(),
  previewImage: z.string(),
  useDefaultBibleSettings: z.boolean(),
  biblePresentationSettingsId: z.number().nullable().optional(),
  biblePresentationSettings: z
    .object({
      description: z.union(Object.values(BibleDescriptionMode).map((mode) => z.literal(mode))),
      position: z.union(Object.values(BibleDescriptionPosition).map((mode) => z.literal(mode))),
      showVersion: z.boolean(),
      showVerseNumber: z.boolean(),
      positionStyle: z.string().nullable()
    })
    .optional()
    .nullable()
})

export const UpdateThemeSchema = CreateThemeSchema.extend({
  biblePresentationSettingsId: z.number().optional()
})
