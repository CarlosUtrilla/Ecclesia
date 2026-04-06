import { getPrisma } from '../../../electron/main/prisma'
import type {
  CreateSongDTO,
  GetSongsDTO,
  SongLyricDTO,
  SongResponseDTO,
  SongsListResponseDTO
} from './songs.dto'

class SongsService {
  prisma = getPrisma()

  private isEmptyLyricContent(content: string) {
    const plain = content
      .replace(/<br\s*\/?>(\n)?/gi, '')
      .replace(/&nbsp;/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    return plain.length === 0
  }

  private sanitizeLyrics(lyrics: CreateSongDTO['lyrics']) {
    return lyrics.filter((lyric) => !this.isEmptyLyricContent(lyric.content))
  }

  private parseLyrics(rawLyrics: string): SongLyricDTO[] {
    try {
      const parsed = JSON.parse(rawLyrics)
      if (!Array.isArray(parsed)) return []

      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null

          const content = (entry as Record<string, unknown>).content
          const tagSongsId = (entry as Record<string, unknown>).tagSongsId

          if (typeof content !== 'string') return null
          if (tagSongsId !== null && typeof tagSongsId !== 'number') return null

          return {
            content,
            tagSongsId: (tagSongsId ?? null) as number | null
          }
        })
        .filter((entry): entry is SongLyricDTO => entry !== null)
    } catch {
      return []
    }
  }

  private mapSongResponse(song: {
    id: number
    title: string
    author: string | null
    copyright: string | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    lyrics: string
    fullText: string
  }): SongResponseDTO {
    return {
      ...song,
      lyrics: this.parseLyrics(song.lyrics)
    }
  }

  normalizeFullText(songData: CreateSongDTO) {
    const fullText = this.sanitizeLyrics(songData.lyrics).map((lyric) => lyric.content)

    fullText.unshift(songData.title)
    songData.author && fullText.unshift(songData.author)
    songData.copyright && fullText.unshift(songData.copyright)

    return fullText
      .join('\n')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }
  // Crear canción
  async createSong(data: CreateSongDTO) {
    const fullText = this.normalizeFullText(data)
    const { lyrics, ...songData } = data
    const sanitizedLyrics = this.sanitizeLyrics(lyrics)

    const song = await this.prisma.song.create({
      data: {
        ...songData,
        fullText,
        lyrics: JSON.stringify(sanitizedLyrics)
      }
    })

    return this.mapSongResponse(song)
  }

  // Obtener canciones con paginación
  async getSongsInfiniteScroll(params: GetSongsDTO): Promise<SongsListResponseDTO> {
    const { page = 1, limit = 20, search } = params
    const skip = (page - 1) * limit

    const where = search
      ? {
          deletedAt: null as null,
          OR: [
            { title: { contains: search } },
            { author: { contains: search } },
            { fullText: { contains: search } }
          ]
        }
      : { deletedAt: null as null }

    const [songs, total] = await Promise.all([
      this.prisma.song.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          title: 'asc'
        }
      }),
      this.prisma.song.count({ where })
    ])

    return {
      songs: (songs || []).map((song) => this.mapSongResponse(song)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  }

  // Obtener una canción por ID
  async getSongById(id: number) {
    const song = await this.prisma.song.findFirst({
      where: { id, deletedAt: null }
    })

    if (!song) return null

    return this.mapSongResponse(song)
  }

  // Actualizar canción
  async updateSong(id: number, data: CreateSongDTO) {
    const fullText = this.normalizeFullText(data)
    const { lyrics, ...songData } = data
    const sanitizedLyrics = this.sanitizeLyrics(lyrics)

    const song = await this.prisma.song.update({
      where: { id },
      data: {
        ...songData,
        fullText,
        lyrics: JSON.stringify(sanitizedLyrics)
      }
    })

    return this.mapSongResponse(song)
  }

  // Eliminar canción
  async deleteSong(id: number): Promise<void> {
    // Soft-delete: marcar como eliminada para que la eliminación se propague por sync
    await this.prisma.song.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  // Buscar canciones
  async searchSongs(query: string, limit = 10) {
    const songs = await this.prisma.song.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: query } },
          { author: { contains: query } },
          { fullText: { contains: query } }
        ]
      },
      take: limit,
      orderBy: {
        title: 'asc'
      }
    })

    return songs.map((song) => {
      const parsedSong = this.mapSongResponse(song)
      return {
        ...parsedSong,
        lyrics: parsedSong.lyrics[0] || null
      }
    })
  }

  async getSongsByIds(ids: number[]): Promise<SongResponseDTO[]> {
    const songs = await this.prisma.song.findMany({
      where: {
        deletedAt: null,
        id: {
          in: ids
        }
      }
    })

    return songs.map((song) => this.mapSongResponse(song))
  }
}

export default SongsService
