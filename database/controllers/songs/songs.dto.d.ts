import { Song } from '@prisma/client'

export type CreateSongDTO = Pick<Song, 'title' | 'author' | 'copyright' | 'fullText'>

export type UpdateSongDTO = {
  id: number
  title?: string
  artist?: string
  author?: string
  copyright?: string
  lyrics?: string
}

export type GetSongsDTO = {
  page: number
  limit?: number
  search?: string
}

export type SongsListResponseDTO = {
  songs: SongResponseDTO[]
  total: number
  page: number
  totalPages: number
}
