import SongsService from './songs.service'
import type {
  CreateSongDTO,
  UpdateSongDTO,
  GetSongsDTO,
  SongResponseDTO,
  SongsListResponseDTO
} from './songs.dto'

class SongsController {
  private songsService = new SongsService()

  async createSong(data: CreateSongDTO): Promise<SongResponseDTO> {
    return this.songsService.createSong(data)
  }

  async getSongsInfiniteScroll(params: GetSongsDTO): Promise<SongsListResponseDTO> {
    return this.songsService.getSongsInfiniteScroll(params)
  }

  async getSongById(id: number): Promise<SongResponseDTO | null> {
    return this.songsService.getSongById(id)
  }

  async updateSong(data: UpdateSongDTO): Promise<SongResponseDTO> {
    return this.songsService.updateSong(data)
  }

  async deleteSong(id: number): Promise<void> {
    return this.songsService.deleteSong(id)
  }

  async searchSongs(query: string, limit?: number): Promise<SongResponseDTO[]> {
    return this.songsService.searchSongs(query, limit)
  }
}

// Exportar clase
export default SongsController
