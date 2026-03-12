import { TagSongs } from '@prisma/client'

export type CreateTagSongsDto = Omit<TagSongs, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTagSongsDto = Omit<TagSongs, 'createdAt' | 'updatedAt'>

export type SaveManyTagSongsItemDto = {
  id: number // > 0 = existente (update), ≤ 0 = nuevo (create)
  name: string
  shortName: string
  shortCut: string
  color: string
  deletedAt: Date | null
}

export type SaveManyTagSongsDto = SaveManyTagSongsItemDto[]
