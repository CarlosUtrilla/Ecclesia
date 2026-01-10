import z from 'zod'

export const CreateSongSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  author: z.string().nullable(),
  copyright: z.string().nullable(),
  fullText: z.string().min(1, 'La letra de la canción es obligatorio'),
  lyrics: z.array(z.any())
})

export const UpdateSongSchema = CreateSongSchema.extend({
  id: z.number()
})
