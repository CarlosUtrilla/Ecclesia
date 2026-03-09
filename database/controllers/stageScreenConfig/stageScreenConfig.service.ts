import { getPrisma } from '../../../electron/main/prisma'
import {
  StageScreenConfigFilterDTO,
  UpsertStageScreenConfigDTO,
  UpdateStageScreenLayoutDTO,
  UpdateStageScreenStateDTO,
  UpdateStageScreenThemeDTO
} from './stageScreenConfig.dto'

const DEFAULT_LAYOUT = '{"version":1,"items":[]}'
const DEFAULT_STATE = '{"message":null,"timers":[]}'

class StageScreenConfigService {
  async getAllStageScreenConfigs(filter?: StageScreenConfigFilterDTO) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.findMany({
      where: {
        ...(filter?.selectedScreenId && { selectedScreenId: filter.selectedScreenId }),
        ...(filter?.themeId && { themeId: filter.themeId })
      },
      include: {
        selectedScreen: true,
        theme: true
      },
      orderBy: {
        selectedScreenId: 'asc'
      }
    })
  }

  async getStageScreenConfigById(id: number) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.findUnique({
      where: { id },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async getStageScreenConfigBySelectedScreenId(selectedScreenId: number) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.findUnique({
      where: { selectedScreenId },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async upsertStageScreenConfig(data: UpsertStageScreenConfigDTO) {
    const prisma = getPrisma()

    return await prisma.stageScreenConfig.upsert({
      where: { selectedScreenId: data.selectedScreenId },
      create: {
        selectedScreenId: data.selectedScreenId,
        themeId: data.themeId ?? null,
        layout: data.layout ?? DEFAULT_LAYOUT,
        state: data.state ?? DEFAULT_STATE
      },
      update: {
        ...(data.themeId !== undefined && { themeId: data.themeId }),
        ...(data.layout !== undefined && { layout: data.layout }),
        ...(data.state !== undefined && { state: data.state })
      },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async updateStageScreenTheme(data: UpdateStageScreenThemeDTO) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.update({
      where: { selectedScreenId: data.selectedScreenId },
      data: {
        themeId: data.themeId
      },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async updateStageScreenLayout(data: UpdateStageScreenLayoutDTO) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.update({
      where: { selectedScreenId: data.selectedScreenId },
      data: {
        layout: data.layout
      },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async updateStageScreenState(data: UpdateStageScreenStateDTO) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.update({
      where: { selectedScreenId: data.selectedScreenId },
      data: {
        state: data.state
      },
      include: {
        selectedScreen: true,
        theme: true
      }
    })
  }

  async deleteStageScreenConfigBySelectedScreenId(selectedScreenId: number) {
    const prisma = getPrisma()
    return await prisma.stageScreenConfig.delete({
      where: { selectedScreenId }
    })
  }
}

export default StageScreenConfigService
