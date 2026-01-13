import { getPrisma } from '../../../electron/main/prisma'
import { CreateThemeDto, UpdateThemeDto } from './themes.dto'
import { Prisma } from '@prisma/client'

export class ThemesService {
  async createTheme(rawData: CreateThemeDto) {
    const prisma = getPrisma()
    const { biblePresentationSettings, ...data } = rawData

    if (biblePresentationSettings) {
      const createdSettings = await prisma.biblePresentationSettings.create({
        data: biblePresentationSettings
      })
      data.biblePresentationSettingsId = createdSettings.id
    }
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
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })
  }

  async getThemeByName(name: string) {
    const prisma = getPrisma()
    return await prisma.themes.findUnique({
      where: { name },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })
  }

  async updateTheme(id: number, rawData: UpdateThemeDto) {
    const prisma = getPrisma()
    const { biblePresentationSettings, ...data } = rawData

    if (biblePresentationSettings) {
      if (data.biblePresentationSettingsId) {
        // Actualizar configuración existente
        await prisma.biblePresentationSettings.update({
          where: { id: data.biblePresentationSettingsId },
          data: biblePresentationSettings
        })
      } else {
        // Crear nueva configuración
        const createdSettings = await prisma.biblePresentationSettings.create({
          data: biblePresentationSettings
        })
        data.biblePresentationSettingsId = createdSettings.id
      }
    }
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
