import { Lyrics, Song } from '@prisma/client'

export type CreateSongDTO = Pick<Song, 'title' | 'author' | 'copyright'> & {
  lyrics: Pick<Lyrics, 'content' | 'tagSongsId'>[]
}

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

export type SongResponseDTO = Song & {
  lyrics: Lyrics[]
}

export type SongsListResponseDTO = {
  songs: SongResponseDTO[]
  total: number
  page: number
  totalPages: number
}
