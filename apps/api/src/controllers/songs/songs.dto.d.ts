import { Song } from '@prisma/client'

export type SongLyricDTO = {
  content: string
  tagSongsId: number | null
}

export type CreateSongDTO = Pick<Song, 'title' | 'author' | 'copyright'> & {
  lyrics: SongLyricDTO[]
}

export type UpdateSongDTO = {
  id: number
  title?: string
  artist?: string
  author?: string
  copyright?: string
  lyrics?: SongLyricDTO[]
}

export type UpdateSongBody = {
  id: number
  data: CreateSongDTO
}

export type GetSongsDTO = {
  page: number
  limit?: number
  search?: string
}

export type SongResponseDTO = Omit<Song, 'lyrics'> & {
  lyrics: SongLyricDTO[]
}

export type SongsListResponseDTO = {
  songs: SongResponseDTO[]
  total: number
  page: number
  totalPages: number
}

export type ImportSongsFromFileDTO = {
  filesPath: string[]
  source: string
  createTags?: boolean
}

export type PreviewMissingTagsDTO = {
  filesPath: string[]
  source: string
}

export type MissingTagPreview = {
  verseName: string
  color: string
}

export type PreviewMissingTagsResponseDTO = {
  missingTags: MissingTagPreview[]
}
