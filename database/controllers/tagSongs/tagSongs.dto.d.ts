import { TagSongs } from '@prisma/client'

export type CreateTagSongsDto = Omit<TagSongs, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTagSongsDto = Omit<TagSongs, 'createdAt' | 'updatedAt'>
