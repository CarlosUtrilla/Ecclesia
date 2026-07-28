import { useQuery } from '@tanstack/react-query'
import { ScheduleSchemaType } from '../schema'
import type { ScheduleItem } from '@ecclesia/api'
import { BookPlusIcon, FileSliders, FileText, Music, Timer, Video } from 'lucide-react'
import useBibleSchema from '@/hooks/useBibleSchema'
import { ContentScreen } from '../types'
import { useCallback } from 'react'
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
import {
  parseBibleAccessData,
  parseBibleVerseRange
} from '@/screens/panels/library/bible/accessData'
import { parseTimerAccessData } from '@/lib/timerAccessData'
import { Api } from '@ecclesia/queries'

export const useIndexDataItems = (currentSchedule: ScheduleSchemaType) => {
  const { getCompleteNameById } = useBibleSchema()
  const { buildMediaUrl } = useMediaServer()
  const { themes } = useThemes()
  const accessDataKey = currentSchedule?.items.map((item) => parseInt(item.accessData))

  const { data: songs = [], dataUpdatedAt } = useQuery({
    queryKey: ['songsByIds', accessDataKey],
    queryFn: async () => {
      if (!currentSchedule) return []
      const songIds = currentSchedule.items
        .filter((item) => item.type === 'SONG')
        .map((item) => parseInt(item.accessData))
      if (songIds.length === 0) return []
      return await Api.fetch.songs.getSongsByIds({ body: { ids: songIds } })
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
      return await Api.fetch.media.getMediaByIds({ body: { ids: mediaIds } })
    },
    enabled: !!currentSchedule
  })

  const { data: presentations = [] } = useQuery({
    queryKey: ['presentationsByIds', accessDataKey],
    queryFn: async () => {
      if (!currentSchedule) return []

      const presentationIds = currentSchedule.items
        .filter((item) => item.type === 'PRESENTATION')
        .map((item) => parseInt(item.accessData))

      if (presentationIds.length === 0) return []

      return await Api.fetch.presentations.getPresentationsByIds({ body: { ids: presentationIds } })
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
        if (med?.type === 'PDF') {
          return <FileText className="h-4 w-4" />
        }
        return <Video className="h-4 w-4" />
      }
      case 'BIBLE':
        return <BookPlusIcon className="h-4 w-4" />
      case 'PRESENTATION':
        return <FileSliders className="h-4 w-4" />
      case 'TIMER':
        return <Timer className="h-4 w-4" />
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
        const loadSong = await Api.fetch.songs.getSongById({ body: { id: parseInt(accessData) } })
        return loadSong?.title || `Canción desconocida`
      }
      case 'MEDIA': {
        const med = media.find((m) => m.id === parseInt(accessData))
        if (med) {
          return med.name
        }
        const loadMedia = await Api.fetch.media.getMediaByIds({
          body: { ids: [parseInt(accessData)] }
        })
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

        const text = `${getCompleteNameById(parsedBibleAccessData.bookId) || parsedBibleAccessData.bookId} ${parsedBibleAccessData.chapter}:${parsedBibleAccessData.verseRange}`
        return (
          <div>
            {text}{' '}
            {parsedBibleAccessData.version ? (
              <span className="text-muted-foreground text-xs">
                ({parsedBibleAccessData.version})
              </span>
            ) : null}
          </div>
        )
      }
      case 'PRESENTATION': {
        const presentation = presentations.find((record) => record.id === parseInt(accessData))

        if (presentation) return presentation.title

        const loaded = await Api.fetch.presentations.getPresentationById({
          body: { id: parseInt(accessData) }
        })
        return loaded?.title || 'Presentación desconocida'
      }
      case 'TIMER': {
        const timer = parseTimerAccessData(accessData)
        return timer.title || 'Cuenta atrás'
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
        const defaultSettings = await Api.fetch.bible.getDefaultBibleSettings()
        const splitMode = isBibleLiveSplitMode(defaultSettings?.chunkMaxLength)
          ? defaultSettings.chunkMaxLength
          : 'auto'
        const maxChunkLength = resolveBibleChunkMaxLength(splitMode)

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
        const texts = await Api.fetch.bible.getVerses({
          body: {
            book: book_id,
            chapter: chapter,
            verses: versesRange,
            version
          }
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
          const fetchedSong = await Api.fetch.songs.getSongById({
            body: { id: songId }
          })
          if (fetchedSong) {
            song = fetchedSong
          }
        }

        if (!song) {
          return {
            title: 'Canción desconocida',
            content: []
          }
        }

        const hasSongMeta = song.author || song.copyright
        const content = song.lyrics.map((lyric) => ({
          text: lyric.content,
          tagSongId: lyric.tagSongsId,
          resourceType: item.type,
          songMeta: hasSongMeta
            ? { title: song.title, author: song.author, copyright: song.copyright }
            : undefined
        }))

        console.log('CONTENT TO SENT SCHEDULE', content)
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
          const loaded = await Api.fetch.media.getMediaByIds({
            body: { ids: [mediaId] }
          })
          mediaItem = loaded?.[0]
        }

        // PDF/PPTX media redirects to its linked presentation
        if ((mediaItem?.type === 'PDF' || mediaItem?.type === 'PPTX') && mediaItem.presentationId) {
          const pres = await Api.fetch.presentations.getPresentationById({
            body: { id: mediaItem.presentationId }
          })
          if (pres) {
            const mediaIds =
              pres.slides?.flatMap((slide: any) => {
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
              }) ?? []
            const slideMediaItems =
              mediaIds.length > 0
                ? await Api.fetch.media.getMediaByIds({
                    body: { ids: Array.from(new Set(mediaIds)) }
                  })
                : []
            const mediaById = new Map(slideMediaItems.map((m: any) => [m.id, m]))
            const themeById = new Map(themes.map((t: any) => [t.id, t]))

            const content = (pres.slides ?? []).map((slide: any) =>
              presentationSlideToViewItem(slide, mediaById, themeById)
            )
            return { title: mediaItem.name, content }
          }
        }

        // Pre-construir la URL del medio para que la ventana live no dependa
        // de su propio MediaServerContext (podría no tener el puerto aún).
        const mediaUrl = mediaItem ? buildMediaUrl(mediaItem.filePath) : ''
        return {
          title: mediaItem?.name || 'Medio',
          content: mediaItem ? [{ ...mediaItem, resourceType: item.type, mediaUrl } as any] : []
        }
      }
      if (type === 'PRESENTATION') {
        const presentationId = parseInt(accessData)
        let presentation = presentations.find((record) => record.id === presentationId)

        if (!presentation) {
          console.log(`presentation id: ${presentationId}`)
          const presentationFetched = await Api.fetch.presentations.getPresentationById({
            body: { id: presentationId }
          })
          if (presentationFetched) {
            presentation = presentationFetched
          }
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
            ? await Api.fetch.media.getMediaByIds({
                body: { ids: Array.from(new Set(mediaIds)) }
              })
            : []
        const mediaById = new Map(mediaItems.map((mediaItem) => [mediaItem.id, mediaItem]))
        const themeById = new Map(themes.map((theme) => [theme.id, theme]))

        const defaultSettings = await Api.fetch.bible.getDefaultBibleSettings()
        const splitMode = isBibleLiveSplitMode(defaultSettings?.chunkMaxLength)
          ? defaultSettings.chunkMaxLength
          : 'auto'
        const maxChunkLength = resolveBibleChunkMaxLength(splitMode)

        const mappedSlides = presentation.slides.map((slide) =>
          presentationSlideToViewItem(slide, mediaById, themeById)
        )
        const slidesWithOverrides = applyPresentationBibleOverrides(
          mappedSlides,
          options?.presentationBibleOverrideByKey
        )

        // Hydrate bible text from server if needed
        const hydratedSlides = await Promise.all(
          slidesWithOverrides.map(async (slide) => {
            // Handle direct BIBLE slides
            if (slide.resourceType === 'BIBLE' && slide.verse && !slide.text?.trim()) {
              const verses = Array.from(
                { length: (slide.verse.verseEnd ?? slide.verse.verse) - slide.verse.verse + 1 },
                (_, i) => slide.verse!.verse + i
              )

              const result = await Api.fetch.bible.getVerses({
                body: {
                  book: slide.verse.bookId,
                  chapter: slide.verse.chapter,
                  verses,
                  version: slide.verse.version
                }
              })

              // Usar el texto como viene de la BD (puede incluir números de verso o no)
              const text = result.map((v) => v.text).join(' ')

              return {
                ...slide,
                text
              }
            }

            // Handle PRESENTATION slides with bible layers
            if (slide.resourceType === 'PRESENTATION' && Array.isArray(slide.presentationItems)) {
              const hydratedLayers = await Promise.all(
                slide.presentationItems.map(async (layer) => {
                  if (layer.resourceType === 'BIBLE' && layer.verse && !layer.text?.trim()) {
                    const verses = Array.from(
                      {
                        length: (layer.verse.verseEnd ?? layer.verse.verse) - layer.verse.verse + 1
                      },
                      (_, i) => layer.verse!.verse + i
                    )

                    const result = await Api.fetch.bible.getVerses({
                      body: {
                        book: layer.verse.bookId,
                        chapter: layer.verse.chapter,
                        verses,
                        version: layer.verse.version
                      }
                    })

                    // Usar el texto como viene de la BD (puede incluir números de verso o no)
                    const text = result.map((v) => v.text).join(' ')

                    return {
                      ...layer,
                      text
                    }
                  }
                  return layer
                })
              )

              return {
                ...slide,
                presentationItems: hydratedLayers
              }
            }

            return slide
          })
        )

        const content = attachPresentationBibleChunkParts(hydratedSlides, maxChunkLength)

        return {
          title: presentation.title,
          content
        }
      }
      if (type === 'TIMER') {
        const timer = parseTimerAccessData(accessData)
        return {
          title: timer.title || 'Cuenta atrás',
          content: [
            {
              id: `timer-${item.id}`,
              text: '',
              resourceType: item.type,
              timer
            }
          ]
        }
      }
      return {
        title: 'Contenido',
        content: [{ text: accessData, resourceType: item.type }]
      }
    },
    [media, presentations, songs, themes, buildMediaUrl, dataUpdatedAt]
  )

  return {
    songs,
    media,
    presentations,
    getScheduleItemIcon,
    getScheduleItemLabel,
    getScheduleItemContentScreen
  }
}
