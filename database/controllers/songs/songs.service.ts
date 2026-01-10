import { getPrisma } from '../../../electron/main/prisma'
import type { CreateSongDTO, GetSongsDTO, SongsListResponseDTO } from './songs.dto'

class SongsService {
  separateFullTextOnLyrics(fullText: string) {
    // Tiptap genera párrafos con <p> tags
    // Un doble salto de línea se representa como dos <p> consecutivos o un <p> vacío
    // Dividimos por párrafos vacíos o dobles saltos de línea

    // Primero, dividir por párrafos
    const paragraphs = fullText.split(/<\/p>\s*<p>/).map((p) => {
      // Limpiar tags de apertura/cierre del inicio y final
      return p
        .replace(/^<p>/, '')
        .replace(/<\/p>$/, '')
        .trim()
    })

    // Agrupar párrafos separados por párrafos vacíos (doble enter)
    const sections: string[] = []
    let currentSection: string[] = []

    paragraphs.forEach((paragraph) => {
      if (paragraph === '' || paragraph === '<br>' || paragraph === '&nbsp;') {
        // Párrafo vacío = doble enter = nueva sección
        if (currentSection.length > 0) {
          sections.push(`<p>${currentSection.join('</p><p>')}</p>`)
          currentSection = []
        }
      } else {
        currentSection.push(paragraph)
      }
    })

    // Agregar la última sección si existe
    if (currentSection.length > 0) {
      sections.push(`<p>${currentSection.join('</p><p>')}</p>`)
    }

    return sections
  }
  // Crear canción
  async createSong(data: CreateSongDTO) {
    const prisma = getPrisma()
    const { lyrics, ...songData } = data

    const song = await prisma.song.create({
      data: {
        ...songData,
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
    const prisma = getPrisma()
    const { page = 1, limit = 20, search } = params
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { artist: { contains: search, mode: 'insensitive' as const } },
            { author: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : {}

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
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
      prisma.song.count({ where })
    ])

    return {
      songs: (songs || []).map((song) => ({
        ...song,
        lyrics: song.lyrics[0] || null
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  }

  // Obtener una canción por ID
  async getSongById(id: number) {
    const prisma = getPrisma()
    const song = await prisma.song.findUnique({
      where: { id },
      include: {
        lyrics: true
      }
    })

    if (!song) return null

    return {
      ...song,
      lyrics: song.lyrics[0] || null
    }
  }

  // Actualizar canción
  async updateSong(id: number, data: CreateSongDTO) {
    const prisma = getPrisma()
    const { lyrics, ...songData } = data

    // Actualizar la canción y las letras si existen
    const song = await prisma.song.update({
      where: { id },
      data: {
        ...songData,
        lyrics:
          lyrics !== undefined
            ? {
                upsert: {
                  create: { content: lyrics },
                  update: { content: lyrics }
                }
              }
            : undefined
      },
      include: {
        lyrics: true
      }
    })

    return {
      ...song,
      lyrics: song.lyrics[0] || null
    }
  }

  // Eliminar canción
  async deleteSong(id: number): Promise<void> {
    const prisma = getPrisma()
    await prisma.song.delete({
      where: { id }
    })
  }

  // Buscar canciones
  async searchSongs(query: string, limit = 10) {
    const prisma = getPrisma()
    const songs = await prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { artist: { contains: query, mode: 'insensitive' as const } },
          { author: { contains: query, mode: 'insensitive' as const } }
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
}

export default SongsService
