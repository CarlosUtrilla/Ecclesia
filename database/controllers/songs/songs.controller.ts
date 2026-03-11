import SongsService from './songs.service'
import type { CreateSongDTO, GetSongsDTO, SongsListResponseDTO } from './songs.dto'
import SongImporter from './songImporter.service'

class SongsController {
  private songsService = new SongsService()
  private songImporter = new SongImporter()
  async createSong(data: CreateSongDTO) {
    return this.songsService.createSong(data)
  }

  async getSongsByIds(ids: number[]) {
    return this.songsService.getSongsByIds(ids)
  }

  async getSongsInfiniteScroll(params: GetSongsDTO): Promise<SongsListResponseDTO> {
    return this.songsService.getSongsInfiniteScroll(params)
  }

  async getSongById(id: number) {
    return this.songsService.getSongById(id)
  }

  async updateSong(id: number, data: CreateSongDTO) {
    return this.songsService.updateSong(id, data)
  }

  async deleteSong(id: number): Promise<void> {
    return this.songsService.deleteSong(id)
  }

  async searchSongs(query: string, limit?: number) {
    return this.songsService.searchSongs(query, limit)
  }

  async importSongsFromFile(filesPath: string[], source: string) {
    return this.songImporter.importSongsFromFile(filesPath, source)
  }
}

// Exportar clase
export default SongsController
