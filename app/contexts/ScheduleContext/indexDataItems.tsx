import { useQuery } from '@tanstack/react-query'
import { ScheduleSchemaType } from './schema'
import { ScheduleItem } from '@prisma/client'
import { BookPlusIcon, Image, Music, Video } from 'lucide-react'
import useBibleSchema from '@/hooks/useBibleSchema'
import { ContentScreen } from './types'
import { useCallback } from 'react'

export const useIndexDataItems = (currentSchedule: ScheduleSchemaType) => {
  const { getCompleteVerseText } = useBibleSchema()
  const accessDataKey = currentSchedule?.items.map((item) => parseInt(item.accessData))

  const { data: songs = [] } = useQuery({
    queryKey: ['songsByIds', accessDataKey],
    queryFn: async () => {
      if (!currentSchedule) return []
      const songIds = currentSchedule.items
        .filter((item) => item.type === 'SONG')
        .map((item) => parseInt(item.accessData))
      if (songIds.length === 0) return []
      return await window.api.songs.getSongsByIds(songIds)
    },
    enabled: !!currentSchedule
  })

  const { data: media = [] } = useQuery({
    queryKey: ['mediaByIds', accessDataKey],
    queryFn: async () => {
      if (!currentSchedule) return []
      const mediaIds = currentSchedule.items
        .filter((item) => item.type === 'MEDIA')
        .map((item) => parseInt(item.accessData))
      if (mediaIds.length === 0) return []
      return await window.api.media.getMediaByIds(mediaIds)
    },
    enabled: !!currentSchedule
  })

  const getScheduleItemIcon = (item: ScheduleItem) => {
    const { accessData, type } = item
    switch (type) {
      case 'SONG':
        return <Music className="h-4 w-4" />
      case 'MEDIA': {
        const med = media.find((m) => m.id === Number(accessData))
        /*  if (med && med.type === 'AUDIO') {
          return <Music className="h-4 w-4" />
        } */
        if (med && med.type === 'VIDEO') {
          return <Video className="h-4 w-4" />
        }
        if (med && med.type === 'IMAGE') {
          return <Image className="h-4 w-4" />
        }
        return <Video className="h-4 w-4" />
      }
      case 'BIBLE':
        return <BookPlusIcon className="h-4 w-4" />
      default:
        return '❓'
    }
  }

  const getScheduleItemLabel = (item: ScheduleItem) => {
    const { accessData, type } = item
    switch (type) {
      case 'SONG': {
        const song = songs.find((s) => s.id === parseInt(accessData))
        if (song) {
          return song.title
        }
        return 'loading...'
      }
      case 'MEDIA': {
        const med = media.find((m) => m.id === parseInt(accessData))
        if (med) {
          return med.name
        }
        return `Medio ID: ${accessData}`
      }
      case 'BIBLE': {
        const splited = accessData.split(',')
        const versesRange = splited[2].split('-')
        const text =
          getCompleteVerseText(
            parseInt(splited[0]),
            parseInt(splited[1]),
            parseInt(versesRange[0]),
            versesRange[1] ? parseInt(versesRange[1]) : undefined
          ) || accessData
        return (
          <div>
            {text}{' '}
            {splited[3] ? (
              <span className="text-muted-foreground text-xs">({splited[3]})</span>
            ) : null}
          </div>
        )
      }
      default:
        return accessData
    }
  }

  const getScheduleItemContentScreen = useCallback(
    async (item: ScheduleItem): Promise<ContentScreen> => {
      const { accessData, type } = item
      if (type === 'BIBLE') {
        const splited = accessData.split(',')
        const versesSplited = splited[2].split('-')
        const versesRange = Array.from(
          {
            length:
              (versesSplited[1] ? parseInt(versesSplited[1]) : parseInt(versesSplited[0])) -
              parseInt(versesSplited[0]) +
              1
          },
          (_, i) => (i + parseInt(versesSplited[0])).toString()
        )
        const book_id = parseInt(splited[0])
        const chapter = parseInt(splited[1])
        const version = splited[3] || 'RVR1960'
        const texts = await window.api.bible.getVerses({
          book: book_id,
          chapter: chapter,
          verses: versesRange.map((v) => parseInt(v)),
          version: version //Actualizar para obtener version seleccionada en la app
        })

        const content = texts.map((text) => ({
          text: text.text,
          verse: {
            bookId: book_id,
            chapter: chapter,
            verse: text.verse,
            version: version
          }
        }))
        return {
          title: `${texts[0]?.book || ''} ${chapter}:${versesSplited[0]}${
            versesSplited[1] ? `-${versesSplited[1]}` : ''
          }`,
          content
        }
      }
      if (type === 'SONG') {
        const songId = parseInt(accessData)
        const song = songs.find((s) => s.id === songId)
        if (!song) return { title: 'Canción no encontrada', content: [] }
        const content = song.lyrics.map((lyric) => ({
          text: lyric.content,
          tagSongId: lyric.tagSongsId
        }))

        return {
          title: song.title,
          content
        }
      }
    },
    [songs]
  )

  return { songs, media, getScheduleItemIcon, getScheduleItemLabel, getScheduleItemContentScreen }
}
