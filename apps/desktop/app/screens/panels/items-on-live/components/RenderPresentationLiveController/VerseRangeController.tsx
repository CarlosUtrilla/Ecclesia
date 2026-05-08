import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { PresentationBibleTarget } from '@/lib/presentationBibleVersionOverrides'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { cn } from '@/lib/utils'
import { trimPreviewText } from './nextSlidePreview.utils'
import VerseTooltipButton from './VerseTooltipButton'

export type VerseController = {
  start: number
  end: number
  current: number
  slideKey: string
  mode: 'verse' | 'chunk'
  layerId?: string
}

type AdjacentVerseDirection = 'previous' | 'next'

type Props = {
  className?: string
  verseController: VerseController
  activeSlide?: PresentationViewItems
  previewSource: PresentationBibleTarget | null
  bibleVersion: string
  bookShortName: string
  slideIndex: number
  onSetVerse: (nextVerse: number) => void
}

export default function VerseRangeController({
  className,
  verseController,
  activeSlide,
  previewSource,
  bibleVersion,
  bookShortName,
  slideIndex,
  onSetVerse
}: Props) {
  const [previousVersePreviewText, setPreviousVersePreviewText] = useState('')
  const [isLoadingPreviousVersePreview, setIsLoadingPreviousVersePreview] = useState(false)
  const previousVersePreviewCacheRef = useRef<Record<string, string>>({})
  const [nextVersePreviewText, setNextVersePreviewText] = useState('')
  const [isLoadingNextVersePreview, setIsLoadingNextVersePreview] = useState(false)
  const nextVersePreviewCacheRef = useRef<Record<string, string>>({})

  const loadAdjacentVersePreview = useCallback(
    async (direction: AdjacentVerseDirection) => {
      if (verseController.mode === 'chunk') {
        const targetStep =
          direction === 'next' ? verseController.current + 1 : verseController.current - 1
        const isOutOfRange =
          direction === 'next'
            ? targetStep > verseController.end
            : targetStep < verseController.start

        if (isOutOfRange) {
          if (direction === 'next') {
            setNextVersePreviewText('No hay siguiente parte')
          } else {
            setPreviousVersePreviewText('No hay parte anterior')
          }
          return
        }

        // Extraer información del chunk adyacente
        let chunkVerse: number | undefined
        let chunkContent: string | undefined

        const targetChunkIndex = targetStep - 1 // chunks son 1-indexed

        if (activeSlide?.resourceType === 'PRESENTATION' && Array.isArray(activeSlide.presentationItems)) {
          const bibleLayer = activeSlide.presentationItems.find(
            (layer) => layer.resourceType === 'BIBLE' && layer.chunks
          )
          if (bibleLayer?.chunks && bibleLayer.chunks[targetChunkIndex]) {
            const chunk = bibleLayer.chunks[targetChunkIndex]
            chunkVerse = chunk.verse
            chunkContent = chunk.content
          }
        } else if (activeSlide?.resourceType === 'BIBLE' && activeSlide.chunks) {
          const chunk = activeSlide.chunks[targetChunkIndex]
          if (chunk) {
            chunkVerse = chunk.verse
            chunkContent = chunk.content
          }
        }

        // Construir el tooltip con referencia bíblica + contenido
        if (chunkVerse !== undefined && chunkContent && previewSource) {
          const verseReference = `${bookShortName} ${previewSource.chapter}:${chunkVerse}`
          const truncatedContent = trimPreviewText(chunkContent)
          const tooltipText = `${verseReference}\n${truncatedContent}`
          
          if (direction === 'next') {
            setNextVersePreviewText(tooltipText)
          } else {
            setPreviousVersePreviewText(tooltipText)
          }
        } else {
          // Fallback si no hay información del chunk
          if (direction === 'next') {
            setNextVersePreviewText(`Ir a parte ${targetStep}`)
          } else {
            setPreviousVersePreviewText(`Ir a parte ${targetStep}`)
          }
        }
        return
      }

      if (!previewSource) {
        if (direction === 'next') {
          setNextVersePreviewText('No hay siguiente verso')
        } else {
          setPreviousVersePreviewText('No hay verso anterior')
        }
        return
      }

      const targetVerse =
        direction === 'next' ? verseController.current + 1 : verseController.current - 1
      const isOutOfRange =
        direction === 'next'
          ? targetVerse > verseController.end
          : targetVerse < verseController.start

      if (isOutOfRange) {
        if (direction === 'next') {
          setNextVersePreviewText('No hay siguiente verso')
        } else {
          setPreviousVersePreviewText('No hay verso anterior')
        }
        return
      }

      const version = bibleVersion || previewSource.version
      const cacheKey = `${slideIndex}:${targetVerse}:${version}`
      const previewCacheRef =
        direction === 'next' ? nextVersePreviewCacheRef : previousVersePreviewCacheRef
      const cachedPreview = previewCacheRef.current[cacheKey]

      const setPreviewText =
        direction === 'next' ? setNextVersePreviewText : setPreviousVersePreviewText
      const setLoadingState =
        direction === 'next' ? setIsLoadingNextVersePreview : setIsLoadingPreviousVersePreview

      if (cachedPreview) {
        setPreviewText(cachedPreview)
        return
      }

      setLoadingState(true)
      try {
        const result = await window.api.bible.getVerses({
          book: previewSource.bookId,
          chapter: previewSource.chapter,
          verses: [targetVerse],
          version
        })

        const verseText = result[0]
          ? `${bookShortName} ${previewSource.chapter}:${result[0].verse}. ${result[0].text}`
          : ''
        const preview = trimPreviewText(verseText)
        const finalPreview = preview || 'Sin vista previa disponible'
        previewCacheRef.current[cacheKey] = finalPreview
        setPreviewText(finalPreview)
      } catch {
        setPreviewText('No se pudo cargar la vista previa')
      } finally {
        setLoadingState(false)
      }
    },
    [
      activeSlide,
      bibleVersion,
      bookShortName,
      previewSource,
      slideIndex,
      verseController.current,
      verseController.end,
      verseController.mode,
      verseController.start
    ]
  )

  const nextVerseTooltipText = isLoadingNextVersePreview
    ? 'Cargando vista previa...'
    : nextVersePreviewText ||
      (verseController.mode === 'chunk'
        ? 'Pasa el mouse para ver la siguiente parte'
        : 'Pasa el mouse para ver el siguiente verso')

  const previousVerseTooltipText = isLoadingPreviousVersePreview
    ? 'Cargando vista previa...'
    : previousVersePreviewText ||
      (verseController.mode === 'chunk'
        ? 'Pasa el mouse para ver la parte anterior'
        : 'Pasa el mouse para ver el verso anterior')

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <VerseTooltipButton
        tooltipText={previousVerseTooltipText}
        onTooltipOpen={() => {
          loadAdjacentVersePreview('previous')
        }}
        onClick={() => onSetVerse(verseController.current - 1)}
        disabled={verseController.current <= verseController.start}
        leftIcon={<ChevronLeft className="size-4" />}
        label="Verso"
      />
      <VerseTooltipButton
        tooltipText={nextVerseTooltipText}
        onTooltipOpen={() => {
          loadAdjacentVersePreview('next')
        }}
        onClick={() => onSetVerse(verseController.current + 1)}
        disabled={verseController.current >= verseController.end}
        rightIcon={<ChevronRight className="size-4" />}
        label="Verso"
      />
    </div>
  )
}
