import { useEffect, useMemo, useRef, useState } from 'react'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import RenderGridMode from '../RenderGridMode'
import { BlankTheme } from '@/hooks/useThemes'
import { useMediaServer } from '@/contexts/MediaServerContext'
import {
  getPresentationSlideKey,
  getSlideVerseRange,
  resolveSlideVerse
} from '@/lib/presentationVerseController'
import {
  buildPresentationBibleBadgeLabel,
  resolvePresentationBookShortName
} from '@/lib/presentationBibleBadge'
import {
  getPresentationBibleTargets,
  getPresentationBibleVersion
} from '@/lib/presentationBibleVersionOverrides'
import useBibleSchema from '@/hooks/useBibleSchema'
import PresentationControllerFooter from './PresentationControllerFooter'
import usePresentationVideoController from './usePresentationVideoController'

type Props = {
  data: PresentationViewItems[]
}

const hasVideoInSlide = (slide?: PresentationViewItems) => {
  if (!slide) return false

  if (slide.resourceType === 'MEDIA') {
    const directVideoType = (slide as { type?: string }).type
    if (directVideoType === 'VIDEO') return true
    return slide.media?.type === 'VIDEO'
  }

  if (slide.resourceType === 'PRESENTATION' && Array.isArray(slide.presentationItems)) {
    return slide.presentationItems.some(
      (layer) => layer.resourceType === 'MEDIA' && layer.media?.type === 'VIDEO'
    )
  }

  return false
}

const getActiveVideoPath = (slide?: PresentationViewItems) => {
  if (!slide) return null

  if (slide.resourceType === 'MEDIA') {
    const directVideoType = (slide as { type?: string }).type
    const directFilePath = (slide as { filePath?: string }).filePath

    if (directVideoType === 'VIDEO' && directFilePath) {
      return directFilePath
    }

    if (slide.media?.type === 'VIDEO') {
      return slide.media.filePath
    }
  }

  if (slide.resourceType === 'PRESENTATION' && Array.isArray(slide.presentationItems)) {
    const firstVideoLayer = slide.presentationItems.find(
      (layer) => layer.resourceType === 'MEDIA' && layer.media?.type === 'VIDEO'
    )
    return firstVideoLayer?.media?.filePath || null
  }

  return null
}

const getActiveVideoDuration = (slide?: PresentationViewItems) => {
  if (!slide) return 0

  const parseDuration = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  if (slide.resourceType === 'MEDIA') {
    const directDuration = parseDuration((slide as { duration?: unknown }).duration)
    if (directDuration > 0) {
      return directDuration
    }

    const nestedDuration = parseDuration(
      (slide.media as { duration?: unknown } | undefined)?.duration
    )
    if (nestedDuration > 0) {
      return nestedDuration
    }
  }

  if (slide.resourceType === 'PRESENTATION' && Array.isArray(slide.presentationItems)) {
    const firstVideoLayer = slide.presentationItems.find(
      (layer) => layer.resourceType === 'MEDIA' && layer.media?.type === 'VIDEO'
    )
    const duration = parseDuration(
      (firstVideoLayer?.media as { duration?: unknown } | undefined)?.duration
    )
    if (duration > 0) {
      return duration
    }
  }

  return 0
}

const getActiveVideoLoop = (slide?: PresentationViewItems) => slide?.videoLoop === true

export default function RenderPresentationLiveController({ data }: Props) {
  const {
    itemIndex,
    setItemIndex,
    sendLiveMediaState,
    liveScreensReady,
    presentationVerseBySlideKey,
    setPresentationVerseBySlideKey,
    setPresentationBibleOverrideByKey
  } = useLive()
  const { buildMediaUrl } = useMediaServer()
  const { bibleSchema } = useBibleSchema()
  const controllerVideoRef = useRef<HTMLVideoElement | null>(null)
  const [isUpdatingBibleVersion, setIsUpdatingBibleVersion] = useState(false)

  const totalSlides = data.length

  useEffect(() => {
    if (totalSlides === 0 && itemIndex !== 0) {
      setItemIndex(0)
      return
    }

    if (totalSlides > 0 && itemIndex > totalSlides - 1) {
      setItemIndex(totalSlides - 1)
    }
  }, [itemIndex, setItemIndex, totalSlides])

  const safeIndex = totalSlides === 0 ? 0 : Math.min(itemIndex, totalSlides - 1)
  const activeSlide = data[safeIndex]
  const activeSlideBibleTargets = useMemo(
    () => getPresentationBibleTargets(activeSlide, safeIndex),
    [activeSlide, safeIndex]
  )
  const activePreviewSource = activeSlideBibleTargets[0]
  const activeSlideBibleVersion = useMemo(
    () => getPresentationBibleVersion(activeSlide, safeIndex),
    [activeSlide, safeIndex]
  )
  const activeBookShortName = useMemo(() => {
    if (!activePreviewSource) return ''

    const foundBook =
      bibleSchema.find((book) => Number(book.id) === activePreviewSource.bookId) ||
      bibleSchema.find((book) => Number(book.book_id) === activePreviewSource.bookId)

    if (!foundBook) return String(activePreviewSource.bookId)

    return String(foundBook.book_short || foundBook.book_id || foundBook.book)
  }, [activePreviewSource, bibleSchema])

  const activeVerseController = resolveSlideVerse(
    activeSlide,
    safeIndex,
    presentationVerseBySlideKey
  )
  const activeSlideHasVideo = useMemo(() => hasVideoInSlide(activeSlide), [activeSlide])
  const activeSlideVideoBehavior = activeSlide?.videoLiveBehavior === 'auto' ? 'auto' : 'manual'
  const activeVideoUrl = useMemo(() => {
    const path = getActiveVideoPath(activeSlide)
    return path ? buildMediaUrl(path) : null
  }, [activeSlide, buildMediaUrl])
  const activeVideoDurationHint = useMemo(() => getActiveVideoDuration(activeSlide), [activeSlide])
  const activeSlideVideoLoop = useMemo(() => getActiveVideoLoop(activeSlide), [activeSlide])
  const previewBadgeByIndex = useMemo(
    () =>
      data.map((slide, index) => {
        const range = getSlideVerseRange(slide)
        if (!range) return null

        const primaryTarget = getPresentationBibleTargets(slide, index)[0]
        if (!primaryTarget) {
          return range.start === range.end ? `v${range.start}` : `v${range.start}-${range.end}`
        }

        const slideKey = getPresentationSlideKey(slide, index)
        const current = presentationVerseBySlideKey[slideKey]
        const bookShortName = resolvePresentationBookShortName(primaryTarget.bookId, bibleSchema)

        return buildPresentationBibleBadgeLabel({
          bookShortName,
          chapter: primaryTarget.chapter,
          rangeStart: range.start,
          rangeEnd: range.end,
          currentVerse: current
        })
      }),
    [data, presentationVerseBySlideKey, bibleSchema]
  )

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    handlePlay,
    handlePause,
    handleRestart,
    handleSeek,
    handleVolumeChange,
    handleControllerTimeUpdate,
    handleControllerEnded,
    handleHiddenVideoPlay,
    handleHiddenVideoPause,
    handleHiddenVideoLoadedMetadata,
    handleHiddenVideoDurationChange,
    handleHiddenVideoVolumeChange
  } = usePresentationVideoController({
    controllerVideoRef,
    sendLiveMediaState,
    activeSlideHasVideo,
    activeSlideVideoBehavior,
    activeVideoDurationHint,
    activeVideoUrl,
    activeSlideVideoLoop,
    liveScreensReady,
    slideIndex: safeIndex
  })

  const handlePrevious = () => {
    if (totalSlides === 0) return
    setItemIndex(Math.max(0, safeIndex - 1))
  }

  const handleNext = () => {
    if (totalSlides === 0) return
    setItemIndex(Math.min(totalSlides - 1, safeIndex + 1))
  }

  const handleSetVerse = (nextVerse: number) => {
    if (!activeVerseController) return

    const boundedVerse = Math.max(
      activeVerseController.start,
      Math.min(activeVerseController.end, nextVerse)
    )
    if (boundedVerse === activeVerseController.current) return

    setPresentationVerseBySlideKey((previous) => ({
      ...previous,
      [activeVerseController.slideKey]: boundedVerse
    }))
  }

  const handleBibleVersionChange = async (newVersion: number | string) => {
    const nextVersion = String(newVersion || '')

    if (
      !nextVersion ||
      activeSlideBibleTargets.length === 0 ||
      nextVersion === activeSlideBibleVersion
    ) {
      return
    }

    setIsUpdatingBibleVersion(true)

    try {
      const overrideEntries = await Promise.all(
        activeSlideBibleTargets.map(async (target) => {
          const verses = Array.from(
            { length: target.verseEnd - target.verseStart + 1 },
            (_, index) => target.verseStart + index
          )

          const result = await window.api.bible.getVerses({
            book: target.bookId,
            chapter: target.chapter,
            verses,
            version: nextVersion
          })

          return [
            target.overrideKey,
            {
              version: nextVersion,
              text: result.map((verse) => `${verse.verse}. ${verse.text}`).join('<br/>')
            }
          ] as const
        })
      )

      setPresentationBibleOverrideByKey((previous) => ({
        ...previous,
        ...Object.fromEntries(overrideEntries)
      }))
    } finally {
      setIsUpdatingBibleVersion(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-auto">
        <RenderGridMode
          data={data}
          previewBadgeByIndex={previewBadgeByIndex}
          activeIndexOverride={safeIndex}
          onSelectIndexOverride={(nextIndex) => {
            setItemIndex(nextIndex)
          }}
          themeOverride={BlankTheme}
          presentationVerseBySlideKey={presentationVerseBySlideKey}
        />
      </div>

      <PresentationControllerFooter
        safeIndex={safeIndex}
        totalSlides={totalSlides}
        onPrevious={handlePrevious}
        onNext={handleNext}
        verseController={activeVerseController}
        activePreviewSource={activePreviewSource}
        activeSlideBibleVersion={activeSlideBibleVersion}
        activeBookShortName={activeBookShortName}
        onSetVerse={handleSetVerse}
        activeSlideHasVideo={activeSlideHasVideo}
        isUpdatingBibleVersion={isUpdatingBibleVersion}
        onBibleVersionChange={handleBibleVersionChange}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onSeek={handleSeek}
        onPlay={handlePlay}
        onPause={handlePause}
        onRestart={handleRestart}
        activeVideoUrl={activeVideoUrl}
        activeSlideVideoLoop={activeSlideVideoLoop}
        controllerVideoRef={controllerVideoRef}
        onHiddenVideoLoadedMetadata={handleHiddenVideoLoadedMetadata}
        onHiddenVideoDurationChange={handleHiddenVideoDurationChange}
        onControllerTimeUpdate={handleControllerTimeUpdate}
        onControllerEnded={handleControllerEnded}
        onHiddenVideoPlay={handleHiddenVideoPlay}
        onHiddenVideoPause={handleHiddenVideoPause}
        onHiddenVideoVolumeChange={handleHiddenVideoVolumeChange}
      />
    </div>
  )
}
