import z from 'zod'

export const CreateSongSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  author: z.string().nullable(),
  copyright: z.string().nullable(),
  lyrics: z
    .array(
      z.object({
        content: z.string(),
        tagSongsId: z.number().nullable()
      })
    )
    .min(1, 'Debe haber al menos un párrafo')
    .refine((arr) => arr.some((item) => item.content.trim() !== ''), {
      message: 'Debe haber al menos un párrafo'
    })
})

export const UpdateSongSchema = CreateSongSchema.extend({
  id: z.number()
})
