import { TagSongsService } from './tagSongs.service'
import { CreateTagSongsDto, UpdateTagSongsDto } from './tagSongs.dto'

export class TagSongsController {
  private tagSongsService = new TagSongsService()

  async createTagSongs(data: CreateTagSongsDto) {
    return await this.tagSongsService.createTagSongs(data)
  }

  async getAllTagSongs() {
    return await this.tagSongsService.getAllTagSongs()
  }

  async getTagSongsById(id: number) {
    return await this.tagSongsService.getTagSongsById(id)
  }

  async getTagSongsByName(name: string) {
    return await this.tagSongsService.getTagSongsByName(name)
  }

  async getTagSongsByShortCut(shortCut: string) {
    return await this.tagSongsService.getTagSongsByShortCut(shortCut)
  }

  async updateTagSongs(id: number, data: UpdateTagSongsDto) {
    return await this.tagSongsService.updateTagSongs(id, data)
  }

  async deleteTagSongs(id: number) {
    return await this.tagSongsService.deleteTagSongs(id)
  }
}
