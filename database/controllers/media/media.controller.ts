import { MediaService } from './media.service'
import { CreateMediaDto, UpdateMediaDto, MediaFilterDto } from './media.dto'

export class MediaController {
  private mediaService = new MediaService()

  async create(data: CreateMediaDto) {
    return await this.mediaService.create(data)
  }

  async findAll(filter: MediaFilterDto) {
    return await this.mediaService.findAll(filter)
  }

  async findOne(id: string) {
    return await this.mediaService.findOne(parseInt(id))
  }

  async update(id: string, data: UpdateMediaDto) {
    return await this.mediaService.update(parseInt(id), data)
  }

  async delete(id: string) {
    return await this.mediaService.delete(parseInt(id))
  }
}
