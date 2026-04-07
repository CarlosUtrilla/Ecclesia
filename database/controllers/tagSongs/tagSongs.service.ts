import { getPrisma } from '../../../electron/main/prisma'
import { Prisma } from '@prisma/client'
import { CreateTagSongsDto, UpdateTagSongsDto, SaveManyTagSongsDto } from './tagSongs.dto'

export class TagSongsService {
  private buildInternalShortCut(seed: string) {
    const safeSeed =
      seed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
        .slice(0, 16) || 'tag'

    const randomPart = Math.random().toString(36).slice(2, 8)
    return `auto-${safeSeed}-${randomPart}`
  }

  async createTagSongs(data: CreateTagSongsDto) {
    const prisma = getPrisma()
    try {
      return await prisma.tagSongs.create({
        data: {
          ...data,
          shortCut: this.buildInternalShortCut(`${data.name}-${data.shortName}`)
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tag con el nombre "${data.name}"`)
        }
      }
      throw error
    }
  }

  async getAllTagSongs() {
    const prisma = getPrisma()
    return await prisma.tagSongs.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    })
  }

  async getTagSongsById(id: number) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findFirst({
      where: { id, deletedAt: null }
    })
  }

  async getTagSongsByName(name: string) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findFirst({
      where: { name, deletedAt: null }
    })
  }

  async getTagSongsByShortCut(shortCut: string) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findFirst({
      where: { shortCut, deletedAt: null }
    })
  }

  async updateTagSongs(id: number, data: UpdateTagSongsDto) {
    const prisma = getPrisma()
    try {
      return await prisma.tagSongs.update({
        where: { id },
        data: {
          ...data,
          shortCut: this.buildInternalShortCut(`${data.name}-${data.shortName}-${id}`)
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tag con el nombre "${data.name}"`)
        }
        if (error.code === 'P2025') {
          throw new Error(`No se encontró el tag con ID ${id}`)
        }
      }
      throw error
    }
  }

  async saveManyTagSongs(tags: SaveManyTagSongsDto) {
    const prisma = getPrisma()
    try {
      return await prisma.$transaction(async (tx) => {
        for (const [index, tag] of tags.entries()) {
          const { name, shortName, color } = tag
          const generatedShortCut = this.buildInternalShortCut(
            `${name}-${shortName}-${tag.id}-${index}`
          )

          if (tag.id > 0) {
            await tx.tagSongs.update({
              where: { id: tag.id },
              data: { name, shortName, shortCut: generatedShortCut, color }
            })
          } else {
            await tx.tagSongs.create({
              data: { name, shortName, shortCut: generatedShortCut, color, deletedAt: null }
            })
          }
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Hay un conflicto de nombres entre los tags. Revisa que no haya duplicados.')
      }
      throw error
    }
  }

  async deleteTagSongs(id: number) {
    const prisma = getPrisma()
    try {
      return await prisma.tagSongs.update({
        where: { id },
        data: { deletedAt: new Date() }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(`No se encontró el tag con ID ${id}`)
        }
      }
      throw error
    }
  }
}
