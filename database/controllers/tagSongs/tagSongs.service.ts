import { getPrisma } from '../../../electron/main/prisma'
import { Prisma } from '@prisma/client'
import { CreateTagSongsDto, UpdateTagSongsDto, SaveManyTagSongsDto } from './tagSongs.dto'

export class TagSongsService {
  async createTagSongs(data: CreateTagSongsDto) {
    const prisma = getPrisma()
    try {
      return await prisma.tagSongs.create({
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(
            `Ya existe un tag con el nombre "${data.name}" o el atajo "${data.shortCut}"`
          )
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
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(
            `Ya existe un tag con el nombre "${data.name}" o el atajo "${data.shortCut}"`
          )
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
        for (const tag of tags) {
          const { name, shortName, shortCut, color } = tag
          if (tag.id > 0) {
            await tx.tagSongs.update({
              where: { id: tag.id },
              data: { name, shortName, shortCut, color }
            })
          } else {
            await tx.tagSongs.create({
              data: { name, shortName, shortCut, color, deletedAt: null }
            })
          }
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error(
          'Hay un conflicto de nombres o atajos entre los tags. Revisa que no haya duplicados.'
        )
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
