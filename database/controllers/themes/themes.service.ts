import { getPrisma } from '../../../electron/main/prisma'
import { CreateThemeDto, ThemeWithMedia, UpdateThemeDto } from './themes.dto'
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
        data: {
          ...data,
          textStyle: JSON.stringify(data.textStyle)
        }
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

  async getAllThemes(): Promise<ThemeWithMedia[]> {
    const prisma = getPrisma()
    const themes = await prisma.themes.findMany({
      where: { deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return themes.map((theme) => ({
      ...theme,
      textStyle: theme.textStyle ? JSON.parse(theme.textStyle) : {}
    }))
  }

  async getThemeById(id: number): Promise<ThemeWithMedia> {
    const prisma = getPrisma()
    const theme = await prisma.themes.findFirst({
      where: { id, deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })
    if (!theme) {
      throw new Error(`Tema con id ${id} no encontrado`)
    }
    return {
      ...theme,
      textStyle: theme?.textStyle ? JSON.parse(theme.textStyle) : {}
    }
  }

  async getThemeByName(name: string): Promise<ThemeWithMedia> {
    const prisma = getPrisma()
    const theme = await prisma.themes.findFirst({
      where: { name, deletedAt: null },
      include: {
        backgroundMedia: true,
        biblePresentationSettings: true
      }
    })

    if (!theme) {
      throw new Error(`Tema con nombre ${name} no encontrado`)
    }
    return {
      ...theme,
      textStyle: theme?.textStyle ? JSON.parse(theme.textStyle) : {}
    }
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
        data: {
          ...data,
          textStyle: JSON.stringify(data.textStyle)
        }
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
    return await prisma.themes.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }
}
