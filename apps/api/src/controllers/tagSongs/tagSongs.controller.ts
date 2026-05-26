import { TagSongsService } from './tagSongs.service'
import { CreateTagSongsDto, UpdateTagSongsDto, SaveManyTagSongsDto } from './tagSongs.dto'
import { RequestHandler } from '../../utils/RequestHandler'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export class TagSongsController {
  private tagSongsService = new TagSongsService()

  @UpdateQueryKey(['tagSongs'])
  async createTagSongs({ body }: RequestHandler<CreateTagSongsDto>) {
    return await this.tagSongsService.createTagSongs(body)
  }

  async getAllTagSongs() {
    return await this.tagSongsService.getAllTagSongs()
  }

  async getTagSongsById({ body }: RequestHandler<{ id: number }>) {
    return await this.tagSongsService.getTagSongsById(body.id)
  }

  async getTagSongsByName({ body }: RequestHandler<{ name: string }>) {
    return await this.tagSongsService.getTagSongsByName(body.name)
  }

  async getTagSongsByShortCut({ body }: RequestHandler<{ shortCut: string }>) {
    return await this.tagSongsService.getTagSongsByShortCut(body.shortCut)
  }

  @UpdateQueryKey(['tagSongs'])
  async updateTagSongs({ body }: RequestHandler<{ id: number } & UpdateTagSongsDto>) {
    return await this.tagSongsService.updateTagSongs(body.id, body)
  }

  @UpdateQueryKey(['tagSongs'])
  async saveManyTagSongs({ body }: RequestHandler<SaveManyTagSongsDto>) {
    return await this.tagSongsService.saveManyTagSongs(body)
  }

  @UpdateQueryKey(['tagSongs'])
  async deleteTagSongs({ body }: RequestHandler<{ id: number }>) {
    return await this.tagSongsService.deleteTagSongs(body.id)
  }
}
