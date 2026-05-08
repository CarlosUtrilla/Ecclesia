import { PresentationsService } from './presentations.service'
import type {
  CreatePresentationDTO,
  GetPresentationsDTO,
  UpdatePresentationDTO
} from './presentations.dto'

import { RequestHandler } from '../../utils/RequestHandler'

export class PresentationsController {
  private presentationsService = new PresentationsService()

  async createPresentation({ body }: RequestHandler<CreatePresentationDTO>) {
    return this.presentationsService.createPresentation(body)
  }

  async getPresentations({ body }: RequestHandler<GetPresentationsDTO>) {
    return this.presentationsService.getPresentations(body)
  }

  async getPresentationsByIds({ body }: RequestHandler<{ ids: number[] }>) {
    return this.presentationsService.getPresentationsByIds(body.ids)
  }

  async getPresentationById({ body }: RequestHandler<{ id: number }>) {
    console.info(`Fetching presentation with ID: ${body.id}, type of ID: ${typeof body.id}`)
    return this.presentationsService.getPresentationById(body.id)
  }

  async updatePresentation({ body }: RequestHandler<{ id: number; data: UpdatePresentationDTO }>) {
    return this.presentationsService.updatePresentation(body.id, body.data)
  }

  async deletePresentation({ body }: RequestHandler<{ id: number }>) {
    return this.presentationsService.deletePresentation(body.id)
  }
}
