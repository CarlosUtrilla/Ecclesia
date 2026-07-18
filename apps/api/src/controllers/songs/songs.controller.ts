import SongsService from './songs.service'
import type {
  CreateSongDTO,
  GetSongsDTO,
  ImportSongsFromFileDTO,
  PreviewMissingTagsDTO,
  SongsListResponseDTO,
  UpdateSongBody
} from './songs.dto'
import SongImporter from './songImporter.service'
import { RequestHandler } from '../../utils/RequestHandler'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

class SongsController {
  private songsService = new SongsService()
  private songImporter = new SongImporter()
  @UpdateQueryKey(['songs'], ['songsByIds'])
  async createSong({ body }: RequestHandler<CreateSongDTO>) {
    return this.songsService.createSong(body)
  }

  async getSongsByIds({ body }: RequestHandler<{ ids: number[] }>) {
    return this.songsService.getSongsByIds(body.ids)
  }

  async getSongsInfiniteScroll({
    body
  }: RequestHandler<GetSongsDTO>): Promise<SongsListResponseDTO> {
    return this.songsService.getSongsInfiniteScroll(body)
  }

  async getSongById({ body }: RequestHandler<{ id: number }>) {
    return this.songsService.getSongById(body.id)
  }

  @UpdateQueryKey(['songs'], ['songsByIds'])
  async updateSong({ body }: RequestHandler<UpdateSongBody>) {
    return this.songsService.updateSong(body)
  }

  @UpdateQueryKey(['songs'], ['songsByIds'])
  async deleteSong({ body }: RequestHandler<{ id: number }>): Promise<void> {
    return this.songsService.deleteSong(body.id)
  }

  async searchSongs({ body }: RequestHandler<{ query: string; limit?: number }>) {
    return this.songsService.searchSongs(body.query, body.limit)
  }

  async importSongsFromFile({
    body: { filesPath, source, createTags }
  }: RequestHandler<ImportSongsFromFileDTO>) {
    return this.songImporter.importSongsFromFile(filesPath, source, createTags)
  }

  async previewMissingTags({
    body: { filesPath, source }
  }: RequestHandler<PreviewMissingTagsDTO>) {
    const missingTags = await this.songImporter.previewMissingTags(filesPath, source)
    return { missingTags }
  }

  async deleteSongsNoLyrics() {
    return this.songsService.deleteSongsNoLyrics()
  }
}

// Exportar clase
export default SongsController
