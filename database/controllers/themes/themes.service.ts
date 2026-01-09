import { getPrisma } from '../../../electron/main/prisma'
import { CreateThemeDto, UpdateThemeDto } from './themes.dto'
import { Prisma } from '@prisma/client'

export class ThemesService {
  async createTheme(data: CreateThemeDto) {
    const prisma = getPrisma()
    try {
      return await prisma.themes.create({
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tema con el nombre "${data.name}"`)
        }
      }
      throw error
    }
  }

  async getAllThemes() {
    const prisma = getPrisma()
    return await prisma.themes.findMany({
      include: {
        backgroundMedia: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getThemeById(id: number) {
    const prisma = getPrisma()
    return await prisma.themes.findUnique({
      where: { id },
      include: {
        backgroundMedia: true
      }
    })
  }

  async getThemeByName(name: string) {
    const prisma = getPrisma()
    return await prisma.themes.findUnique({
      where: { name },
      include: {
        backgroundMedia: true
      }
    })
  }

  async updateTheme(id: number, data: UpdateThemeDto) {
    const prisma = getPrisma()
    try {
      return await prisma.themes.update({
        where: { id },
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Ya existe un tema con el nombre "${data.name}"`)
        }
      }
      throw error
    }
  }

  async deleteTheme(id: number) {
    const prisma = getPrisma()
    return await prisma.themes.delete({
      where: { id }
    })
  }
}
