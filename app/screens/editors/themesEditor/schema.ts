import { z } from 'zod'
import { BiblePresentationSchema } from '../biblePresentationConfiguration/schema'
export const CreateThemeSchema = z.object({
  name: z.string().min(1, 'El nombre del tema es obligatorio'),
  background: z.string(),
  backgroundMediaId: z.number().nullable(),
  textStyle: z.custom<React.CSSProperties>(),
  animationSettings: z.string(),
  transitionSettings: z.string(),
  previewImage: z.string(),
  useDefaultBibleSettings: z.boolean(),
  biblePresentationSettingsId: z.number().nullable().optional(),
  biblePresentationSettings: BiblePresentationSchema.extend({
    id: z.number().optional()
  })
    .optional()
    .nullable()
})

export const UpdateThemeSchema = CreateThemeSchema.extend({
  biblePresentationSettingsId: z.number().nullable().optional()
})
