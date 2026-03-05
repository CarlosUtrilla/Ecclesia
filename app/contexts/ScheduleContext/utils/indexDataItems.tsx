import { useQuery } from '@tanstack/react-query'
import { ScheduleSchemaType } from '../schema'
import { ScheduleItem } from '@prisma/client'
import { BookPlusIcon, FileSliders, Music, Video } from 'lucide-react'
import useBibleSchema from '@/hooks/useBibleSchema'
import { ContentScreen } from '../types'
import { useCallback, useEffect } from 'react'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { useMediaServer } from '../../MediaServerContext'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { useThemes } from '@/hooks/useThemes'

export const useIndexDataItems = (currentSchedule: ScheduleSchemaType) => {
  const { getCompleteVerseText } = useBibleSchema()
  const { buildMediaUrl } = useMediaServer()
  const { themes } = useThemes()
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

  const { data: media = [], refetch: refetchMedia } = useQuery({
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

  const { data: presentations = [], refetch: refetchPresentationsByIds } = useQuery({
    queryKey: ['presentationsByIds', accessDataKey],
    queryFn: async () => {
      if (!currentSchedule) return []

      const presentationIds = currentSchedule.items
        .filter((item) => item.type === 'PRESENTATION')
        .map((item) => parseInt(item.accessData))

      if (presentationIds.length === 0) return []

      return window.api.presentations.getPresentationsByIds(presentationIds)
    },
    enabled: !!currentSchedule
  })

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('presentation-saved', () => {
      refetchPresentationsByIds()
      refetchMedia()
    })

    return unsubscribe
  }, [refetchMedia, refetchPresentationsByIds])

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
        //RETORNAR THUMBNAIL SI ES IMAGEN O VIDEO
        if (med && (med.type === 'IMAGE' || med.type === 'VIDEO')) {
          return (
            <img
              src={buildMediaUrl(med.thumbnail || med.filePath)}
              alt={med.name}
              className="size-8 object-contain"
            />
          )
        }
        return <Video className="h-4 w-4" />
      }
      case 'BIBLE':
        return <BookPlusIcon className="h-4 w-4" />
      case 'PRESENTATION':
        return <FileSliders className="h-4 w-4" />
      default:
        return '❓'
    }
  }

  const getScheduleItemLabel = async (item: ScheduleItem) => {
    const { accessData, type } = item
    switch (type) {
      case 'SONG': {
        const song = songs.find((s) => s.id === parseInt(accessData))
        if (song) {
          return song.title
        }
        const loadSong = await window.api.songs.getSongById(parseInt(accessData))
        return loadSong?.title || `Canción desconocida`
      }
      case 'MEDIA': {
        const med = media.find((m) => m.id === parseInt(accessData))
        if (med) {
          return med.name
        }
        const loadMedia = await window.api.media.getMediaByIds([parseInt(accessData)])
        if (loadMedia) {
          return loadMedia[0].name
        }
        return `Medio desconocido`
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
      case 'PRESENTATION': {
        const presentation = presentations.find((record) => record.id === parseInt(accessData))

        if (presentation) return presentation.title

        const loaded = await window.api.presentations.getPresentationById(parseInt(accessData))
        return loaded?.title || 'Presentación desconocida'
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
          },
          resourceType: item.type
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
        let song = songs.find((s) => s.id === songId)
        if (!song) {
          // si no esta en cache puede ser un item mandado a live directamente
          song = (await window.api.songs.getSongById(songId)) as SongResponseDTO
          songs.push(song)
        }
        const content = song.lyrics.map((lyric) => ({
          text: lyric.content,
          tagSongId: lyric.tagSongsId,
          resourceType: item.type
        }))

        return {
          title: song.title,
          content
        }
      }
      if (type === 'MEDIA') {
        const mediaId = parseInt(accessData)
        let mediaItem = media.find((m) => m.id === mediaId)
        if (!mediaItem) {
          // si no está en cache puede ser un item mandado a live directamente
          const loaded = await window.api.media.getMediaByIds([mediaId])
          mediaItem = loaded?.[0]
          if (mediaItem) media.push(mediaItem)
        }
        return {
          title: mediaItem?.name || 'Medio',
          content: mediaItem ? [{ ...mediaItem, resourceType: item.type } as any] : [] // Cast para evitar error de tipo
        }
      }
      if (type === 'PRESENTATION') {
        const presentationId = parseInt(accessData)
        let presentation = presentations.find((record) => record.id === presentationId)

        if (!presentation) {
          presentation = await window.api.presentations.getPresentationById(presentationId)
          if (!presentation) {
            return {
              title: 'Presentación',
              content: []
            }
          }
        }

        const mediaIds = presentation.slides.flatMap((slide: any) => {
          if (Array.isArray(slide.items)) {
            return slide.items
              .filter((item: any) => item.type === 'MEDIA' && item.accessData)
              .map((item: any) => Number(item.accessData))
              .filter((id: number) => Number.isFinite(id))
          }

          if (slide.type === 'MEDIA' && slide.mediaId) {
            return [Number(slide.mediaId)]
          }

          return []
        })

        const mediaItems =
          mediaIds.length > 0
            ? await window.api.media.getMediaByIds(Array.from(new Set(mediaIds)))
            : []
        const mediaById = new Map(mediaItems.map((mediaItem) => [mediaItem.id, mediaItem]))
        const themeById = new Map(themes.map((theme) => [theme.id, theme]))

        const mappedSlides = presentation.slides.map((slide) =>
          presentationSlideToViewItem(slide, mediaById, themeById)
        )

        return {
          title: presentation.title,
          content: mappedSlides
        }
      }
      return {
        title: 'Contenido',
        content: [{ text: accessData, resourceType: item.type }]
      }
    },
    [media, presentations, songs, themes]
  )

  return {
    songs,
    media,
    getScheduleItemIcon,
    getScheduleItemLabel,
    getScheduleItemContentScreen
  }
}
