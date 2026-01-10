import { getPrisma } from '../../../electron/main/prisma'
import { Prisma } from '@prisma/client'
import { CreateTagSongsDto, UpdateTagSongsDto } from './tagSongs.dto'

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
      orderBy: { name: 'asc' }
    })
  }

  async getTagSongsById(id: number) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findUnique({
      where: { id }
    })
  }

  async getTagSongsByName(name: string) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findUnique({
      where: { name }
    })
  }

  async getTagSongsByShortCut(shortCut: string) {
    const prisma = getPrisma()
    return await prisma.tagSongs.findUnique({
      where: { shortCut }
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

  async deleteTagSongs(id: number) {
    const prisma = getPrisma()
    try {
      return await prisma.tagSongs.delete({
        where: { id }
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
