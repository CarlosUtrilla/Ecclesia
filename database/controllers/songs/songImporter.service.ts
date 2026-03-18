import { readFileSync } from 'fs'
import { getPrisma } from '../../../electron/main/prisma'
import { HolyricsSongDTO } from './songImporter.dto'
import SongsService from './songs.service'

class SongsController {
  prisma = getPrisma()
  songService = new SongsService()
  public importSongsFromFile(filesPath: string[], source: string) {
    if (source === 'holyrics') {
      return this.holyricsImporter(filesPath)
    }
    throw new Error('Source not supported')
  }

  private async holyricsImporter(filesPath: string[]) {
    // leer cada archivo JSON y crear canciones
    const songsData: HolyricsSongDTO[] = await Promise.all(
      filesPath.map((filePath) => {
        const fileContent = readFileSync(filePath)
        return JSON.parse(fileContent.toString())
      })
    )
    const tags = await this.prisma.tagSongs.findMany()
    const response = await Promise.allSettled(
      songsData.map(async (songData) => {
        const { title, author, lyrics, copyright } = songData
        let currentTagId: number | null = null
        await this.songService.createSong({
          title,
          author,
          copyright,
          lyrics: lyrics.paragraphs.map((p) => {
            const tag = tags.find((t) => p.description.toLowerCase().includes(t.name.toLowerCase()))
            if (tag) {
              currentTagId = tag.id
            }
            return { content: p.text, tagSongsId: currentTagId }
          })
        })
      })
    )
    if (response.some((res) => res.status === 'rejected')) {
      console.error(
        'Error importing songs:',
        response.filter((res) => res.status === 'rejected')
      )
    }
    if (response.some((res) => res.status === 'fulfilled')) {
      return true
    }

    return false
  }
}
export default SongsController
