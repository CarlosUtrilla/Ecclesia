import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { PresentationBibleTarget } from '@/lib/presentationBibleVersionOverrides'
import { cn } from '@/lib/utils'
import { trimPreviewText } from './nextSlidePreview.utils'
import VerseTooltipButton from './VerseTooltipButton'

export type VerseController = {
  start: number
  end: number
  current: number
  slideKey: string
}

type AdjacentVerseDirection = 'previous' | 'next'

type Props = {
  className?: string
  verseController: VerseController
  previewSource: PresentationBibleTarget | null
  bibleVersion: string
  bookShortName: string
  slideIndex: number
  onSetVerse: (nextVerse: number) => void
}

export default function VerseRangeController({
  className,
  verseController,
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
      bibleVersion,
      bookShortName,
      previewSource,
      slideIndex,
      verseController.current,
      verseController.end,
      verseController.start
    ]
  )

  const nextVerseTooltipText = isLoadingNextVersePreview
    ? 'Cargando vista previa...'
    : nextVersePreviewText || 'Pasa el mouse para ver el siguiente verso'

  const previousVerseTooltipText = isLoadingPreviousVersePreview
    ? 'Cargando vista previa...'
    : previousVersePreviewText || 'Pasa el mouse para ver el verso anterior'

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
