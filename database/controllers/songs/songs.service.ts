import { getPrisma } from '../../../electron/main/prisma'
import type { CreateSongDTO, GetSongsDTO, SongResponseDTO, SongsListResponseDTO } from './songs.dto'

class SongsService {
  prisma = getPrisma()
  normalizeFullText(songData: CreateSongDTO) {
    const fullText = songData.lyrics.map((lyric) => lyric.content)

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

    const song = await this.prisma.song.create({
      data: {
        ...songData,
        fullText,
        lyrics: {
          createMany: {
            data: lyrics.map((content) => ({
              content: content.content,
              tagSongsId: content.tagSongsId
            }))
          }
        }
      },
      include: {
        lyrics: true
      }
    })

    return song
  }

  // Obtener canciones con paginación
  async getSongsInfiniteScroll(params: GetSongsDTO): Promise<SongsListResponseDTO> {
    const { page = 1, limit = 20, search } = params
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { title: { contains: search } },
            { author: { contains: search } },
            { fullText: { contains: search } }
          ]
        }
      : {}

    const [songs, total] = await Promise.all([
      this.prisma.song.findMany({
        where,
        skip,
        take: limit,
        include: {
          lyrics: true
        },
        orderBy: {
          title: 'asc'
        }
      }),
      this.prisma.song.count({ where })
    ])

    return {
      songs: (songs || []).map((song) => ({
        ...song,
        lyrics: song.lyrics
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  }

  // Obtener una canción por ID
  async getSongById(id: number) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        lyrics: true
      }
    })

    if (!song) return null

    return {
      ...song,
      lyrics: song.lyrics
    }
  }

  // Actualizar canción
  async updateSong(id: number, data: CreateSongDTO) {
    const fullText = this.normalizeFullText(data)
    const { lyrics, ...songData } = data

    // Eliminar letras existentes
    await this.prisma.lyrics.deleteMany({
      where: { songId: id }
    })

    // Actualizar la canción y las letras si existen
    const song = await this.prisma.song.update({
      where: { id },
      data: {
        ...songData,
        fullText,
        lyrics: {
          createMany: {
            data: lyrics.map((content) => ({
              content: content.content,
              tagSongsId: content.tagSongsId
            }))
          }
        }
      },
      include: {
        lyrics: true
      }
    })

    return song
  }

  // Eliminar canción
  async deleteSong(id: number): Promise<void> {
    // eliminar letras asociadas
    await this.prisma.lyrics.deleteMany({
      where: { songId: id }
    })
    // eliminar canción
    await this.prisma.song.delete({
      where: { id }
    })
  }

  // Buscar canciones
  async searchSongs(query: string, limit = 10) {
    const songs = await this.prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { author: { contains: query } },
          { fullText: { contains: query } }
        ]
      },
      take: limit,
      include: {
        lyrics: true
      },
      orderBy: {
        title: 'asc'
      }
    })

    return songs.map((song) => ({
      ...song,
      lyrics: song.lyrics[0] || null
    }))
  }

  getSongsByIds(ids: number[]): Promise<SongResponseDTO[]> {
    return this.prisma.song.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: {
        lyrics: true
      }
    })
  }
}

export default SongsService
