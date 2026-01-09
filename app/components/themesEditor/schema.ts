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
  previewImage: z.string()
})

export const UpdateThemeSchema = z.object({
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
  id: z.number()
})
