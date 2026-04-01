import { useQuery } from '@tanstack/react-query'
import { ScheduleSchemaType } from '../schema'
import type { ScheduleItem } from '@prisma/client'
import { BookPlusIcon, FileSliders, Music, Video } from 'lucide-react'
import useBibleSchema from '@/hooks/useBibleSchema'
import { ContentScreen } from '../types'
import { useCallback, useEffect } from 'react'
import { useMemo, useState } from 'react'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { useMediaServer } from '../../MediaServerContext'
import {
  attachPresentationBibleChunkParts,
  presentationSlideToViewItem
} from '@/lib/presentationSlides'
import {
  applyPresentationBibleOverrides,
  PresentationBibleOverrideMap
} from '@/lib/presentationBibleVersionOverrides'
import { useThemes } from '@/hooks/useThemes'
import {
  isBibleLiveSplitMode,
  resolveBibleChunkMaxLength,
  splitLongBibleVerse
} from '@/lib/splitLongBibleVerse'
import type { ThemeWithMedia } from '@/ui/PresentationView/types'
import { parseBibleAccessData, parseBibleVerseRange } from '@/screens/panels/library/bible/accessData'

const BIBLE_LIVE_CHUNK_MODE_KEY = 'BIBLE_LIVE_CHUNK_MODE'

function getThemeFontSize(theme: ThemeWithMedia): string | number | null {
  const textStyle = theme.textStyle

  if (!textStyle) return null

  if (typeof textStyle === 'string') {
    try {
      const parsedTextStyle = JSON.parse(textStyle) as { fontSize?: string | number }
      return parsedTextStyle.fontSize ?? null
    } catch {
      return null
    }
  }

  if (typeof textStyle === 'object' && textStyle !== null) {
    return (textStyle as { fontSize?: string | number }).fontSize ?? null
  }

  return null
}

export const useIndexDataItems = (
  currentSchedule: ScheduleSchemaType,
  selectedTheme: ThemeWithMedia
) => {
  const { getCompleteNameById } = useBibleSchema()
  const { buildMediaUrl } = useMediaServer()
  const { themes } = useThemes()
  const [directLiveSongs, setDirectLiveSongs] = useState<SongResponseDTO[]>([])
  const [directLiveMedia, setDirectLiveMedia] = useState<any[]>([])
  const [directLivePresentations, setDirectLivePresentations] = useState<any[]>([])
  const accessDataKey = currentSchedule?.items.map((item) => parseInt(item.accessData))

  const { data: queriedSongs = [] } = useQuery({
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

  const { data: queriedMedia = [], refetch: refetchMedia } = useQuery({
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

  const { data: queriedPresentations = [], refetch: refetchPresentationsByIds } = useQuery({
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

  const songs = useMemo(() => {
    const byId = new Map<number, SongResponseDTO>()
    queriedSongs.forEach((song) => byId.set(song.id, song))
    directLiveSongs.forEach((song) => byId.set(song.id, song))
    return Array.from(byId.values())
  }, [queriedSongs, directLiveSongs])

  const media = useMemo(() => {
    const byId = new Map<number, any>()
    queriedMedia.forEach((mediaItem) => byId.set(mediaItem.id, mediaItem))
    directLiveMedia.forEach((mediaItem) => byId.set(mediaItem.id, mediaItem))
    return Array.from(byId.values())
  }, [queriedMedia, directLiveMedia])

  const presentations = useMemo(() => {
    const byId = new Map<number, any>()
    queriedPresentations.forEach((presentation) => byId.set(presentation.id, presentation))
    directLivePresentations.forEach((presentation) => byId.set(presentation.id, presentation))
    return Array.from(byId.values())
  }, [queriedPresentations, directLivePresentations])

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
        const parsedBibleAccessData = parseBibleAccessData(accessData)

        if (!parsedBibleAccessData) {
          return accessData
        }

        const text =
          `${getCompleteNameById(parsedBibleAccessData.bookId) || parsedBibleAccessData.bookId} ${parsedBibleAccessData.chapter}:${parsedBibleAccessData.verseRange}`
        return (
          <div>
            {text}{' '}
            {parsedBibleAccessData.version ? (
              <span className="text-muted-foreground text-xs">({parsedBibleAccessData.version})</span>
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
    async (
      item: ScheduleItem,
      options?: { presentationBibleOverrideByKey?: PresentationBibleOverrideMap }
    ): Promise<ContentScreen> => {
      const { accessData, type } = item
      if (type === 'BIBLE') {
        const splitSettings = await window.api.setttings.getSettings([
          BIBLE_LIVE_CHUNK_MODE_KEY as never
        ])
        const splitModeValue = splitSettings.find((setting) => setting.key === BIBLE_LIVE_CHUNK_MODE_KEY)?.value
        const splitMode = isBibleLiveSplitMode(splitModeValue) ? splitModeValue : 'auto'
        const maxChunkLength = resolveBibleChunkMaxLength(
          splitMode,
          getThemeFontSize(selectedTheme)
        )

        const parsedBibleAccessData = parseBibleAccessData(accessData)
        if (!parsedBibleAccessData) {
          return {
            title: 'Referencia bíblica inválida',
            content: []
          }
        }

        const versesRange = parseBibleVerseRange(parsedBibleAccessData.verseRange)
        if (versesRange.length === 0) {
          return {
            title: 'Referencia bíblica inválida',
            content: []
          }
        }

        const book_id = parsedBibleAccessData.bookId
        const chapter = parsedBibleAccessData.chapter
        const version = parsedBibleAccessData.version
        const texts = await window.api.bible.getVerses({
          book: book_id,
          chapter: chapter,
          verses: versesRange,
          version
        })

        const content = texts.flatMap((text) => {
          const chunks = splitLongBibleVerse(text.text, maxChunkLength)

          return chunks.map((chunkText, chunkIndex) => ({
            id: `bible-${book_id}-${chapter}-${text.verse}-${chunkIndex}`,
            text: chunkText,
            verse: {
              bookId: book_id,
              chapter: chapter,
              verse: text.verse,
              version: version
            },
            resourceType: item.type
          }))
        })

        return {
          title: `${texts[0]?.book || getCompleteNameById(book_id) || ''} ${chapter}:${parsedBibleAccessData.verseRange}`,
          content
        }
      }
      if (type === 'SONG') {
        const songId = parseInt(accessData)
        let song = songs.find((s) => s.id === songId)
        if (!song) {
          // si no esta en cache puede ser un item mandado a live directamente
          const loadedSong = await window.api.songs.getSongById(songId)
          if (loadedSong) {
            song = loadedSong as SongResponseDTO
            setDirectLiveSongs((previous) =>
              previous.some((record) => record.id === song!.id) ? previous : [...previous, song!]
            )
          }
        }

        if (!song) {
          return {
            title: 'Canción desconocida',
            content: []
          }
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
          if (mediaItem) {
            setDirectLiveMedia((previous) =>
              previous.some((record) => record.id === mediaItem.id)
                ? previous
                : [...previous, mediaItem]
            )
          }
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

          setDirectLivePresentations((previous) =>
            previous.some((record) => record.id === presentation!.id)
              ? previous
              : [...previous, presentation!]
          )
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

        const splitSettings = await window.api.setttings.getSettings([
          BIBLE_LIVE_CHUNK_MODE_KEY as never
        ])
        const splitModeValue = splitSettings.find(
          (setting) => setting.key === BIBLE_LIVE_CHUNK_MODE_KEY
        )?.value
        const splitMode = isBibleLiveSplitMode(splitModeValue) ? splitModeValue : 'auto'
        const maxChunkLength = resolveBibleChunkMaxLength(
          splitMode,
          getThemeFontSize(selectedTheme)
        )

        const mappedSlides = presentation.slides.map((slide) =>
          presentationSlideToViewItem(slide, mediaById, themeById)
        )
        const slidesWithOverrides = applyPresentationBibleOverrides(
          mappedSlides,
          options?.presentationBibleOverrideByKey
        )
        const content = attachPresentationBibleChunkParts(slidesWithOverrides, maxChunkLength)

        return {
          title: presentation.title,
          content
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
