import { RequestHandler } from '../../utils/RequestHandler'
import {
  CreateSelectedScreenDTO,
  UpdateSelectedScreenDTO,
  SelectedScreenFilter
} from './selectedScreens.dto'
import SelectedScreensService from './selectedScreens.service'
import { ScreenRol } from '@prisma/client'

class SelectedScreensController {
  private selectedScreensService = new SelectedScreensService()

  async getAllSelectedScreens({ body }: RequestHandler<SelectedScreenFilter | undefined>) {
    return await this.selectedScreensService.getAllSelectedScreens(body)
  }

  async getSelectedScreenById({ body }: RequestHandler<{ id: number }>) {
    return await this.selectedScreensService.getSelectedScreenById(body.id)
  }

  async getSelectedScreenByScreenId({ body }: RequestHandler<{ screenId: number }>) {
    return await this.selectedScreensService.getSelectedScreenByScreenId(body.screenId)
  }

  async getSelectedScreensByRole({ body }: RequestHandler<{ rol: ScreenRol }>) {
    return await this.selectedScreensService.getSelectedScreensByRole(body.rol)
  }

  async createSelectedScreen({ body }: RequestHandler<CreateSelectedScreenDTO>) {
    return await this.selectedScreensService.createSelectedScreen(body)
  }

  async updateSelectedScreen({ body }: RequestHandler<UpdateSelectedScreenDTO>) {
    return await this.selectedScreensService.updateSelectedScreen(body)
  }

  async deleteSelectedScreen({ body }: RequestHandler<{ id: number }>) {
    return await this.selectedScreensService.deleteSelectedScreen(body.id)
  }

  async deleteSelectedScreenByScreenId({ body }: RequestHandler<{ screenId: number }>) {
    return await this.selectedScreensService.deleteSelectedScreenByScreenId(body.screenId)
  }

  async clearScreensByRole({ body }: RequestHandler<{ rol: ScreenRol }>) {
    return await this.selectedScreensService.clearScreensByRole(body.rol)
  }

  async clearAllScreens() {
    return await this.selectedScreensService.clearAllScreens()
  }
}

export default SelectedScreensController
