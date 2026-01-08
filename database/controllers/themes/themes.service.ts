import { getPrisma } from '../../../electron/main/prisma'
import { CreateThemeDto, UpdateThemeDto } from './themes.dto'

export class ThemesService {
  async createTheme(data: CreateThemeDto) {
    const prisma = getPrisma()
    return await prisma.themes.create({
      data
    })
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
    return await prisma.themes.update({
      where: { id },
      data
    })
  }

  async deleteTheme(id: number) {
    const prisma = getPrisma()
    return await prisma.themes.delete({
      where: { id }
    })
  }
}
