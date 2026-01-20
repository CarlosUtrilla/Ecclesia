import {
  CreateSelectedScreenDTO,
  UpdateSelectedScreenDTO,
  SelectedScreenFilter
} from './selectedScreens.dto'
import SelectedScreensService from './selectedScreens.service'
import { ScreenRol } from '@prisma/client'

class SelectedScreensController {
  private selectedScreensService = new SelectedScreensService()

  async getAllSelectedScreens(filter?: SelectedScreenFilter) {
    return await this.selectedScreensService.getAllSelectedScreens(filter)
  }

  async getSelectedScreenById(id: number) {
    return await this.selectedScreensService.getSelectedScreenById(id)
  }

  async getSelectedScreenByScreenId(screenId: number) {
    return await this.selectedScreensService.getSelectedScreenByScreenId(screenId)
  }

  async getSelectedScreensByRole(rol: ScreenRol) {
    return await this.selectedScreensService.getSelectedScreensByRole(rol)
  }

  async createSelectedScreen(data: CreateSelectedScreenDTO) {
    return await this.selectedScreensService.createSelectedScreen(data)
  }

  async updateSelectedScreen(data: UpdateSelectedScreenDTO) {
    return await this.selectedScreensService.updateSelectedScreen(data)
  }

  async deleteSelectedScreen(id: number) {
    return await this.selectedScreensService.deleteSelectedScreen(id)
  }

  async deleteSelectedScreenByScreenId(screenId: number) {
    return await this.selectedScreensService.deleteSelectedScreenByScreenId(screenId)
  }

  async clearScreensByRole(rol: ScreenRol) {
    return await this.selectedScreensService.clearScreensByRole(rol)
  }

  async clearAllScreens() {
    return await this.selectedScreensService.clearAllScreens()
  }
}

export default SelectedScreensController
