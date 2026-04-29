import { PresentationsService } from './presentations.service'
import type {
  CreatePresentationDTO,
  GetPresentationsDTO,
  UpdatePresentationDTO
} from './presentations.dto'
import Logger from 'electron-log'

export class PresentationsController {
  private presentationsService = new PresentationsService()

  async createPresentation(data: CreatePresentationDTO) {
    return this.presentationsService.createPresentation(data)
  }

  async getPresentations(params?: GetPresentationsDTO) {
    return this.presentationsService.getPresentations(params)
  }

  async getPresentationsByIds(ids: number[]) {
    return this.presentationsService.getPresentationsByIds(ids)
  }

  async getPresentationById(id: number) {
    Logger.info(`Fetching presentation with ID: ${id}, type of ID: ${typeof id}`)
    return this.presentationsService.getPresentationById(id)
  }

  async updatePresentation(id: number, data: UpdatePresentationDTO) {
    return this.presentationsService.updatePresentation(id, data)
  }

  async deletePresentation(id: number) {
    return this.presentationsService.deletePresentation(id)
  }
}
