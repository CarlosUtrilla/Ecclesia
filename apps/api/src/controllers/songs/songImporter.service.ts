import { readFileSync } from 'fs'
import { getPrisma } from '../../prisma'
import { HolyricsSongDTO, OpenLpSongDTO } from './songImporter.dto'
import SongsService from './songs.service'
import type { MissingTagPreview } from './songs.dto'

const FALLBACK_TAG_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316'
]

function pickColor(index: number): string {
  return FALLBACK_TAG_COLORS[index % FALLBACK_TAG_COLORS.length]
}

class SongsController {
  prisma = getPrisma()
  songService = new SongsService()
  public importSongsFromFile(filesPath: string[], source: string, createTags = true) {
    if (source === 'holyrics') {
      return this.holyricsImporter(filesPath, createTags)
    }
    if (source === 'openlp') {
      return this.openlpImporter(filesPath)
    }
    if (source === 'ecclesia') {
      return this.ecclesiaImporter(filesPath, createTags)
    }
    throw new Error('Source not supported')
  }

  public async previewMissingTags(
    filesPath: string[],
    source: string
  ): Promise<MissingTagPreview[]> {
    if (source !== 'holyrics') return []

    const verseNames = this.extractHolyricsVerseNames(filesPath)
    const tags = await this.prisma.tagSongs.findMany()
    const seen = new Set<string>()
    const missing: MissingTagPreview[] = []
    let colorIdx = 0
    for (const name of verseNames) {
      const lower = name.toLowerCase()
      if (seen.has(lower)) continue
      const matches = tags.some((t) => lower.includes(t.name.toLowerCase()))
      if (!matches) {
        seen.add(lower)
        missing.push({ verseName: name, color: pickColor(colorIdx++) })
      }
    }
    return missing
  }

  private extractHolyricsVerseNames(filesPath: string[]): string[] {
    const names: string[] = []
    for (const filePath of filesPath) {
      const fileContent = readFileSync(filePath)
      const data: HolyricsSongDTO = JSON.parse(fileContent.toString())
      for (const p of data.lyrics.paragraphs) {
        if (p.description) names.push(p.description.trim())
      }
    }
    return names
  }

  private async holyricsImporter(filesPath: string[], createTags: boolean) {
    const songsData: HolyricsSongDTO[] = await Promise.all(
      filesPath.map((filePath) => {
        const fileContent = readFileSync(filePath)
        return JSON.parse(fileContent.toString())
      })
    )
    const tags = createTags ? await this.prisma.tagSongs.findMany() : []
    const response = await Promise.allSettled(
      songsData.map(async (songData) => {
        const { title, author, lyrics, copyright } = songData
        let currentTagId: number | null = null
        await this.songService.createSong({
          title,
          author,
          copyright,
          lyrics: lyrics.paragraphs.map((p) => {
            if (createTags) {
              const tag = tags.find((t) =>
                p.description.toLowerCase().includes(t.name.toLowerCase())
              )
              if (tag) {
                currentTagId = tag.id
              }
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

  private parseOpenLpXml(xmlContent: string): OpenLpSongDTO {
    const titleMatch = xmlContent.match(/<titles>\s*<title>([^<]*)<\/title>\s*<\/titles>/)
    const authorMatch = xmlContent.match(/<authors>\s*<author>([^<]*)<\/author>\s*<\/authors>/)

    const verseRegex = /<verse\s+name="([^"]*)">\s*<lines>([\s\S]*?)<\/lines>\s*<\/verse>/g
    const lyrics: { verseName: string; lines: string }[] = []
    let match: RegExpExecArray | null
    while ((match = verseRegex.exec(xmlContent)) !== null) {
      lyrics.push({
        verseName: match[1],
        lines: match[2].trim()
      })
    }

    return {
      title: titleMatch?.[1]?.trim() ?? 'Sin título',
      author: authorMatch?.[1]?.trim() ?? '',
      lyrics
    }
  }

  private async openlpImporter(filesPath: string[]) {
    const songsData: OpenLpSongDTO[] = filesPath.map((filePath) => {
      const fileContent = readFileSync(filePath, 'utf-8')
      return this.parseOpenLpXml(fileContent)
    })

    const response = await Promise.allSettled(
      songsData.map(async (songData) => {
        const { title, author, lyrics } = songData
        await this.songService.createSong({
          title,
          author,
          copyright: '',
          lyrics: lyrics.map((v) => {
            return { content: v.lines, tagSongsId: null }
          })
        })
      })
    )

    if (response.some((res) => res.status === 'rejected')) {
      console.error(
        'Error importing OpenLP songs:',
        response.filter((res) => res.status === 'rejected')
      )
    }
    if (response.some((res) => res.status === 'fulfilled')) {
      return true
    }

    return false
  }

  private async ecclesiaImporter(filesPath: string[], createTags: boolean) {
    const allSongs: { title: string; author: string; copyright: string; lyrics: { content: string; tagName: string | null; tagColor: string | null }[] }[] = []

    for (const filePath of filesPath) {
      const fileContent = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(fileContent)
      if (data.format === 'ecclesia-songs' && Array.isArray(data.songs)) {
        allSongs.push(...data.songs)
      }
    }

    const tags = createTags ? await this.prisma.tagSongs.findMany() : []
    const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t]))

    const response = await Promise.allSettled(
      allSongs.map(async (songData) => {
        const { title, author, copyright, lyrics } = songData
        const resolvedLyrics: { content: string; tagSongsId: number | null }[] = []

        for (const lyric of lyrics) {
          let tagId: number | null = null
          if (createTags && lyric.tagName) {
            const existing = tagMap.get(lyric.tagName.toLowerCase())
            if (existing) {
              tagId = existing.id
            } else {
              const shortName =
                lyric.tagName
                  .trim()
                  .split(/\s+/)
                  .map((w: string) => w.charAt(0).toUpperCase())
                  .join('')
                  .substring(0, 4) || 'TAG'
              const newTag = await this.prisma.tagSongs.create({
                data: {
                  name: lyric.tagName,
                  shortName,
                  color: lyric.tagColor ?? '#3b82f6',
                  deletedAt: null
                }
              })
              tagMap.set(lyric.tagName.toLowerCase(), newTag)
              tagId = newTag.id
            }
          }
          resolvedLyrics.push({ content: lyric.content, tagSongsId: tagId })
        }

        await this.songService.createSong({
          title,
          author,
          copyright,
          lyrics: resolvedLyrics
        })
      })
    )

    if (response.some((res) => res.status === 'rejected')) {
      console.error(
        'Error importing Ecclesia songs:',
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
