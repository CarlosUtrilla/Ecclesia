import { Edit2 } from 'lucide-react'
import type { Media } from '@prisma/client'
import { Button } from '@/ui/button'
import { BlankTheme } from '@/hooks/useThemes'
import { useThemes } from '@/hooks/useThemes'
import { PresentationView } from '@/ui/PresentationView'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { generateUniqueId } from '@/lib/utils'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useMemo, useRef, useState } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { getPresentationSlideKey, getSlideVerseRange } from '@/lib/presentationVerseController'
import { attachPresentationBibleChunkParts } from '@/lib/presentationSlides'
import { resolveBibleChunkMaxLength, isBibleLiveSplitMode } from '@/lib/splitLongBibleVerse'
import { useQuery } from '@tanstack/react-query'

const BIBLE_LIVE_CHUNK_MODE_KEY = 'BIBLE_LIVE_CHUNK_MODE'

type Props = {
  presentation: {
    id: number
    title: string
    slides: any[]
  }
  presentationMediaById: Map<number, Media>
}

export default function PresentationPreview({ presentation, presentationMediaById }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { themes } = useThemes()
  const { showItemOnLiveScreen } = useLive()
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes])
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null)

  // Obtener configuración de chunk size
  const { data: splitSettings = [] } = useQuery({
    queryKey: ['bible-chunk-mode-setting'],
    queryFn: () => window.api.setttings.getSettings([BIBLE_LIVE_CHUNK_MODE_KEY as never])
  })

  const maxChunkLength = useMemo(() => {
    const splitModeValue = splitSettings.find(
      (setting) => setting.key === BIBLE_LIVE_CHUNK_MODE_KEY
    )?.value
    const splitMode = isBibleLiveSplitMode(splitModeValue) ? splitModeValue : 'auto'
    // Usar tema por defecto del slide si existe, sino BlankTheme
    const defaultTheme = themes[0] || BlankTheme
    return resolveBibleChunkMaxLength(splitMode, defaultTheme.fontSize)
  }, [splitSettings, themes])

  // Recopilar todas las referencias bíblicas que necesitan hidratación
  const bibleReferences = useMemo(() => {
    const refs: Array<{ slideIndex: number; layerIndex?: number; bible: any }> = []

    presentation.slides.forEach((slide, slideIndex) => {
      if (Array.isArray(slide.items)) {
        slide.items.forEach((item: any, layerIndex: number) => {
          if (item.type === 'BIBLE' && item.accessData) {
            const [bookRaw, chapterRaw, verseRangeRaw, versionRaw] = item.accessData.split(',')
            refs.push({
              slideIndex,
              layerIndex,
              bible: {
                bookId: Number(bookRaw),
                chapter: Number(chapterRaw),
                verseRange: verseRangeRaw,
                version: versionRaw || 'RVR1960'
              }
            })
          }
        })
      }
    })

    return refs
  }, [presentation.slides])

  // Hidratar textos bíblicos
  const { data: hydratedTexts = [] } = useQuery({
    queryKey: ['presentation-preview-bible-texts', presentation.id, bibleReferences],
    queryFn: async () => {
      return Promise.all(
        bibleReferences.map(async (ref) => {
          const [verseStartRaw, verseEndRaw] = ref.bible.verseRange.split('-')
          const verseStart = Number(verseStartRaw)
          const verseEnd = verseEndRaw ? Number(verseEndRaw) : verseStart
          const verses = Array.from({ length: verseEnd - verseStart + 1 }, (_, i) => verseStart + i)

          const result = await window.api.bible.getVerses({
            book: ref.bible.bookId,
            chapter: ref.bible.chapter,
            verses,
            version: ref.bible.version
          })

          return {
            ...ref,
            text: result.map((v) => v.text).join(' ')
          }
        })
      )
    },
    enabled: bibleReferences.length > 0
  })

  // Convertir slides a viewItems y generar chunks
  const viewItemsWithChunks = useMemo(() => {
    return presentation.slides.map((slide, slideIndex) => {
      let viewItem = presentationSlideToViewItem(slide, presentationMediaById, themeById)

      // Si es una presentación con layers, hidratar textos bíblicos
      if (viewItem.resourceType === 'PRESENTATION' && viewItem.presentationItems) {
        const hydratedLayers = viewItem.presentationItems.map((layer, layerIndex) => {
          if (layer.resourceType === 'BIBLE' && layer.verse) {
            const matchingText = hydratedTexts.find(
              (ht) => ht.slideIndex === slideIndex && ht.layerIndex === layerIndex
            )

            if (matchingText) {
              return { ...layer, text: matchingText.text }
            }
          }
          return layer
        })

        viewItem = { ...viewItem, presentationItems: hydratedLayers }

        // Generar chunks
        const itemsWithChunks = attachPresentationBibleChunkParts([viewItem], maxChunkLength)
        return itemsWithChunks[0] || viewItem
      }

      return viewItem
    })
  }, [presentation.slides, presentationMediaById, themeById, hydratedTexts, maxChunkLength])

  const handleShowSlideOnLive = (slideIndex: number) => {
    showItemOnLiveScreen(
      {
        id: generateUniqueId(),
        type: 'PRESENTATION',
        accessData: presentation.id.toString(),
        order: -1,
        scheduleId: -1,
        updatedAt: new Date(),
        deletedAt: null
      },
      slideIndex
    )
  }

  // Calcular presentationVerseBySlideKey para mostrar el primer chunk en cada slide
  const presentationVerseBySlideKey = useMemo(() => {
    const mapping: Record<string, number> = {}
    viewItemsWithChunks.forEach((viewItem, slideIndex) => {
      const slideKey = getPresentationSlideKey(viewItem, slideIndex)
      const range = getSlideVerseRange(viewItem)

      // Si tiene chunks (modo chunk), ponerlo en chunk 1 (índice 1-based)
      if (range?.mode === 'chunk') {
        mapping[slideKey] = 1
      }
    })
    return mapping
  }, [viewItemsWithChunks])

  useKeyboardShortcuts(containerRef, {
    onEnter: () => {
      console.log('on entewr')
      if (selectedSlide !== null) {
        handleShowSlideOnLive(selectedSlide)
      }
    }
  })
  return (
    <div className="panel-scrollable h-full">
      <div className="panel-header flex items-center justify-between pb-3">
        <div>
          <h3 className="font-semibold">{presentation.title}</h3>
          <p className="text-xs text-muted-foreground">
            {presentation.slides.length} diapositiva
            {presentation.slides.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => window.windowAPI.openPresentationWindow(presentation.id)}>
          <Edit2 className="size-4" />
          Editar
        </Button>
      </div>
      <div
        ref={containerRef}
        className="panel-scroll-content flex flex-wrap items-start content-start gap-2 p-1"
      >
        {viewItemsWithChunks.map((viewItem, slideIndex) => (
          <PresentationView
            items={[viewItem]}
            theme={BlankTheme}
            className="max-w-40 h-auto"
            selected={selectedSlide === slideIndex}
            onClick={() => setSelectedSlide(slideIndex)}
            onDoubleClick={() => handleShowSlideOnLive(slideIndex)}
            presentationVerseBySlideKey={presentationVerseBySlideKey}
            currentIndex={slideIndex}
            key={slideIndex}
          />
        ))}
      </div>
    </div>
  )
}
