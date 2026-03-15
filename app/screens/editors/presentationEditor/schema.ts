import { z } from 'zod'

export const SlideTextStyleSchema = z.object({
  fontSize: z.number().min(12).max(120),
  fontFamily: z.string().optional(),
  lineHeight: z.number().min(1).max(3).optional(),
  letterSpacing: z.number().min(0).max(10).optional(),
  color: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textDecoration: z.enum(['none', 'underline']).optional(),
  offsetX: z.number().min(-400).max(400),
  offsetY: z.number().min(-300).max(300),
  mediaWidth: z.number().min(10).max(100).optional(),
  mediaHeight: z.number().min(10).max(100).optional()
})

export const SlideBibleSchema = z.object({
  bookId: z.number().min(1),
  chapter: z.number().min(1),
  verseStart: z.number().min(1),
  verseEnd: z.number().min(1).optional(),
  version: z.string().min(1)
})

export const SlideItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['TEXT', 'BIBLE', 'SONG', 'MEDIA', 'GROUP', 'SHAPE']),
  accessData: z.string().optional(),
  text: z.string().optional(),
  customStyle: z.string().optional(),
  layer: z.number().optional(),
  animationSettings: z.string().optional()
})

export const PresentationSlideSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['TEXT', 'BIBLE', 'MEDIA']),
  slideName: z.string().trim().max(120).optional(),
  themeId: z.number().nullable().optional(),
  backgroundColor: z.string().optional(),
  videoLoop: z.boolean().optional(),
  canvaSourceKey: z.string().min(1).optional(),
  canvaSlideNumber: z.number().int().min(1).optional(),
  items: z.array(SlideItemSchema).optional(),
  transitionSettings: z.string().optional(),
  videoLiveBehavior: z.enum(['auto', 'manual']).optional(),
  text: z.string().optional(),
  mediaId: z.number().optional(),
  bible: SlideBibleSchema.optional(),
  textStyle: SlideTextStyleSchema.optional()
})

export const PresentationSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  slides: z.array(PresentationSlideSchema).min(1, 'Debes agregar al menos una diapositiva')
})

export type PresentationFormValues = z.input<typeof PresentationSchema>
