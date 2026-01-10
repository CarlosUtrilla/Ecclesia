import SongsService from './songs.service'
import type { CreateSongDTO, GetSongsDTO, SongsListResponseDTO } from './songs.dto'

class SongsController {
  private songsService = new SongsService()

  async createSong(data: CreateSongDTO) {
    return this.songsService.createSong(data)
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
}

// Exportar clase
export default SongsController
