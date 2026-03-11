import { getPrisma } from '../../../electron/main/prisma'
import {
  CreateSelectedScreenDTO,
  UpdateSelectedScreenDTO,
  SelectedScreenFilter
} from './selectedScreens.dto'
import { ScreenRol } from '@prisma/client'

// Prisma retorna screenId como BigInt (para soportar IDs de pantalla en Windows > 2^31).
// Convertimos a number en el boundary para mantener los DTOs como number.
function mapScreenId<T extends { screenId: bigint }>(
  record: T
): Omit<T, 'screenId'> & { screenId: number } {
  return { ...record, screenId: Number(record.screenId) }
}

class SelectedScreensService {
  async getAllSelectedScreens(filter?: SelectedScreenFilter) {
    const prisma = getPrisma()
    const records = await prisma.selectedScreens.findMany({
      where: {
        ...(filter?.rol && { rol: filter.rol }),
        ...(filter?.screenId !== undefined && { screenId: BigInt(filter.screenId) })
      },
      orderBy: {
        rol: 'asc'
      }
    })
    return records.map(mapScreenId)
  }

  async getSelectedScreenById(id: number) {
    const prisma = getPrisma()
    const record = await prisma.selectedScreens.findUnique({
      where: { id }
    })
    return record ? mapScreenId(record) : null
  }

  async getSelectedScreenByScreenId(screenId: number) {
    const prisma = getPrisma()
    const record = await prisma.selectedScreens.findUnique({
      where: { screenId: BigInt(screenId) }
    })
    return record ? mapScreenId(record) : null
  }

  async getSelectedScreensByRole(rol: ScreenRol) {
    const prisma = getPrisma()
    const records = await prisma.selectedScreens.findMany({
      where: { rol }
    })
    return records.map(mapScreenId)
  }

  async createSelectedScreen(data: CreateSelectedScreenDTO) {
    const prisma = getPrisma()
    const record = await prisma.selectedScreens.create({
      data: { ...data, screenId: BigInt(data.screenId) }
    })
    return mapScreenId(record)
  }

  async updateSelectedScreen(data: UpdateSelectedScreenDTO) {
    const prisma = getPrisma()
    const { id, screenId, ...rest } = data
    const record = await prisma.selectedScreens.update({
      where: { id },
      data: {
        ...rest,
        ...(screenId !== undefined && { screenId: BigInt(screenId) })
      }
    })
    return mapScreenId(record)
  }

  async deleteSelectedScreen(id: number) {
    const prisma = getPrisma()
    const record = await prisma.selectedScreens.delete({
      where: { id }
    })
    return mapScreenId(record)
  }

  async deleteSelectedScreenByScreenId(screenId: number) {
    const prisma = getPrisma()
    const record = await prisma.selectedScreens.delete({
      where: { screenId: BigInt(screenId) }
    })
    return mapScreenId(record)
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
