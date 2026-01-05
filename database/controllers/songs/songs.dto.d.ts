export type CreateSongDTO = {
  title: string
  artist?: string
  author?: string
  copyright?: string
  lyrics?: string // HTML content
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

export type SongResponseDTO = {
  id: number
  title: string
  artist: string | null
  author: string | null
  copyright: string | null
  createdAt: Date
  updatedAt: Date
  lyrics?: {
    id: number
    content: string
  } | null
}

export type SongsListResponseDTO = {
  songs: SongResponseDTO[]
  total: number
  page: number
  totalPages: number
}
