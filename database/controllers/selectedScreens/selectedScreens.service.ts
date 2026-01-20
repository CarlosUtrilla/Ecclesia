import { getPrisma } from '../../../electron/main/prisma'
import {
  CreateSelectedScreenDTO,
  UpdateSelectedScreenDTO,
  SelectedScreenFilter
} from './selectedScreens.dto'
import { ScreenRol } from '@prisma/client'

class SelectedScreensService {
  async getAllSelectedScreens(filter?: SelectedScreenFilter) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.findMany({
      where: {
        ...(filter?.rol && { rol: filter.rol }),
        ...(filter?.screenId && { screenId: filter.screenId })
      },
      orderBy: {
        rol: 'asc'
      }
    })
  }

  async getSelectedScreenById(id: number) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.findUnique({
      where: { id }
    })
  }

  async getSelectedScreenByScreenId(screenId: number) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.findUnique({
      where: { screenId }
    })
  }

  async getSelectedScreensByRole(rol: ScreenRol) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.findMany({
      where: { rol }
    })
  }

  async createSelectedScreen(data: CreateSelectedScreenDTO) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.create({
      data
    })
  }

  async updateSelectedScreen(data: UpdateSelectedScreenDTO) {
    const prisma = getPrisma()
    const { id, ...updateData } = data
    return await prisma.selectedScreens.update({
      where: { id },
      data: updateData
    })
  }

  async deleteSelectedScreen(id: number) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.delete({
      where: { id }
    })
  }

  async deleteSelectedScreenByScreenId(screenId: number) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.delete({
      where: { screenId }
    })
  }

  async clearScreensByRole(rol: ScreenRol) {
    const prisma = getPrisma()
    return await prisma.selectedScreens.deleteMany({
      where: { rol }
    })
  }

  async clearAllScreens() {
    const prisma = getPrisma()
    return await prisma.selectedScreens.deleteMany()
  }
}

export default SelectedScreensService
