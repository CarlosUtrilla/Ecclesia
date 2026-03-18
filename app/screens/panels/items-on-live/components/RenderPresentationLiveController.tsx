import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { Button } from '@/ui/button'
import RenderGridMode from './RenderGridMode'
import { BlankTheme } from '@/hooks/useThemes'
import { useMediaServer } from '@/contexts/MediaServerContext'
import VideoLiveControls from './VideoLiveControls'
import {
  getPresentationSlideKey,
  getSlideVerseRange,
  resolveSlideVerse
} from '@/lib/presentationVerseController'
import {
  getPresentationBibleTargets,
  getPresentationBibleVersion
} from '@/lib/presentationBibleVersionOverrides'
import BibleVersionSelector from './BibleVersionSelector'

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

    const nestedDuration = parseDuration((slide.media as { duration?: unknown } | undefined)?.duration)
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
  const controllerVideoRef = useRef<HTMLVideoElement | null>(null)
  const sendLiveMediaStateRef = useRef(sendLiveMediaState)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isUpdatingBibleVersion, setIsUpdatingBibleVersion] = useState(false)

  const totalSlides = data.length

  useEffect(() => {
    sendLiveMediaStateRef.current = sendLiveMediaState
  }, [sendLiveMediaState])

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

  const activeVerseController = resolveSlideVerse(activeSlide, safeIndex, presentationVerseBySlideKey)
  const activeVerseRange =
    activeVerseController && activeVerseController.end > activeVerseController.start
      ? activeVerseController
      : null

  const activeSlideHasVideo = useMemo(() => hasVideoInSlide(activeSlide), [activeSlide])
  const activeSlideVideoBehavior = activeSlide?.videoLiveBehavior === 'auto' ? 'auto' : 'manual'
  const activeVideoUrl = useMemo(() => {
    const path = getActiveVideoPath(activeSlide)
    return path ? buildMediaUrl(path) : null
  }, [activeSlide, buildMediaUrl])
  const activeVideoDurationHint = useMemo(() => getActiveVideoDuration(activeSlide), [activeSlide])
  const activeSlideVideoLoop = useMemo(() => getActiveVideoLoop(activeSlide), [activeSlide])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(activeVideoDurationHint)

    const localVideo = controllerVideoRef.current
    if (localVideo) {
      localVideo.pause()
      localVideo.currentTime = 0
    }

    if (!liveScreensReady) return

    let retryTimeouts: number[] = []

    const queueSyncPlay = () => {
      const syncDelays = [120, 320, 700]
      retryTimeouts = syncDelays.map((delayMs) =>
        window.setTimeout(() => {
          sendLiveMediaStateRef.current({ action: 'seek', time: 0 })
          sendLiveMediaStateRef.current({ action: 'play', time: 0 })
        }, delayMs)
      )
    }

    if (activeSlideHasVideo) {
      if (activeSlideVideoBehavior === 'auto') {
        setIsPlaying(true)
        if (localVideo) {
          localVideo.currentTime = 0
          localVideo.play().catch(() => {
            // noop: puede fallar temporalmente por política de autoplay
          })
        }

        // Reintentos cortos para cubrir desmontaje/montaje al cambiar de slide.
        queueSyncPlay()
      } else {
        sendLiveMediaStateRef.current({ action: 'seek', time: 0 })
        sendLiveMediaStateRef.current({ action: 'pause', time: 0 })
      }
    }

    return () => {
      retryTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [
    activeSlideHasVideo,
    activeSlideVideoBehavior,
    activeVideoDurationHint,
    safeIndex,
    liveScreensReady
  ])

  const handlePrevious = () => {
    if (totalSlides === 0) return
    setItemIndex(Math.max(0, safeIndex - 1))
  }

  const handleNext = () => {
    if (totalSlides === 0) return
    setItemIndex(Math.min(totalSlides - 1, safeIndex + 1))
  }

  const setActiveVerse = (nextVerse: number) => {
    if (!activeVerseController) return

    const boundedVerse = Math.max(activeVerseController.start, Math.min(activeVerseController.end, nextVerse))
    if (boundedVerse === activeVerseController.current) return

    setPresentationVerseBySlideKey((previous) => ({
      ...previous,
      [activeVerseController.slideKey]: boundedVerse
    }))
  }

  const handlePreviousVerse = () => {
    if (!activeVerseController) return
    setActiveVerse(activeVerseController.current - 1)
  }

  const handleNextVerse = () => {
    if (!activeVerseController) return
    setActiveVerse(activeVerseController.current + 1)
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

  const handlePlay = () => {
    controllerVideoRef.current?.play().catch(() => {
      // noop: el controlador local puede no iniciar por autoplay policy
    })
    setIsPlaying(true)
    sendLiveMediaStateRef.current({ action: 'play', time: currentTime })
  }

  const handlePause = () => {
    controllerVideoRef.current?.pause()
    setIsPlaying(false)
    sendLiveMediaStateRef.current({ action: 'pause', time: currentTime })
  }

  const handleRestart = () => {
    if (controllerVideoRef.current) {
      controllerVideoRef.current.currentTime = 0
      controllerVideoRef.current.play().catch(() => {
        // noop
      })
    }
    setIsPlaying(true)
    setCurrentTime(0)
    sendLiveMediaStateRef.current({ action: 'restart', time: 0 })
  }

  const handleSeek = (time: number) => {
    const nextTime = Math.max(0, Math.min(time, duration || time))
    if (controllerVideoRef.current) {
      controllerVideoRef.current.currentTime = nextTime
    }
    setCurrentTime(nextTime)
    sendLiveMediaStateRef.current({ action: 'seek', time: nextTime })
  }

  const handleVolumeChange = (nextVolume: number) => {
    if (controllerVideoRef.current) {
      controllerVideoRef.current.volume = nextVolume
    }
    setVolume(nextVolume)
  }

  const handleControllerTimeUpdate = () => {
    const localVideo = controllerVideoRef.current
    if (!localVideo) return
    setCurrentTime(localVideo.currentTime)
  }

  const handleControllerEnded = () => {
    if (activeSlideVideoLoop) {
      setCurrentTime(0)
      setIsPlaying(true)
      return
    }

    setIsPlaying(false)
    setCurrentTime(duration)
  }

  useEffect(() => {
    if (!activeVideoUrl || duration > 0) return

    let attempts = 0
    const maxAttempts = 20
    const pollInterval = window.setInterval(() => {
      const nextDuration = Number(controllerVideoRef.current?.duration || 0)
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration)
        window.clearInterval(pollInterval)
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        window.clearInterval(pollInterval)
      }
    }, 150)

    return () => window.clearInterval(pollInterval)
  }, [activeVideoUrl, duration])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-auto">
        <RenderGridMode
          data={data}
          previewBadgeByIndex={data.map((slide, index) => {
            const range = getSlideVerseRange(slide)
            if (!range) return null

            const slideKey = getPresentationSlideKey(slide, index)
            const current = presentationVerseBySlideKey[slideKey]
            if (current === undefined || current === range.start) {
              return `v${range.start}-${range.end}`
            }

            return `${current}/${range.end}`
          })}
          activeIndexOverride={safeIndex}
          onSelectIndexOverride={(nextIndex) => {
            setItemIndex(nextIndex)
          }}
          themeOverride={BlankTheme}
          presentationVerseBySlideKey={presentationVerseBySlideKey}
        />
      </div>

      <div className="shrink-0 border-t bg-background/80 px-3 py-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handlePrevious}
          disabled={safeIndex <= 0 || totalSlides === 0}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleNext}
          disabled={safeIndex >= totalSlides - 1 || totalSlides === 0}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>

        <div className="text-xs text-muted-foreground ml-2">
          Diapositiva {totalSlides === 0 ? 0 : safeIndex + 1} / {totalSlides}
          {activeVerseRange
            ? ` · Verso ${activeVerseRange.current}/${activeVerseRange.end}`
            : ''}
        </div>

        {activeVerseRange ? (
          <div className="ml-2 flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePreviousVerse}
              disabled={activeVerseRange.current <= activeVerseRange.start}
            >
              <ChevronLeft className="size-4" />
              Verso
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleNextVerse}
              disabled={activeVerseRange.current >= activeVerseRange.end}
            >
              Verso
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}

        {activeSlideBibleVersion || activeSlideHasVideo ? (
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {activeSlideBibleVersion ? (
              <BibleVersionSelector
                value={activeSlideBibleVersion}
                onValueChange={handleBibleVersionChange}
                isLoading={isUpdatingBibleVersion}
                previewSource={
                  activePreviewSource
                    ? {
                        bookId: activePreviewSource.bookId,
                        chapter: activePreviewSource.chapter,
                        verseStart: activePreviewSource.verseStart,
                        verseEnd: activePreviewSource.verseEnd
                      }
                    : null
                }
              />
            ) : null}

            {activeSlideHasVideo ? <div className="h-6 w-px bg-border" /> : null}

            {activeSlideHasVideo ? (
              <>
                <VideoLiveControls
                  className="flex items-center gap-2 w-[min(46rem,60%)] bg-background/80 p-1.5 rounded shadow"
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                  onSeek={handleSeek}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onRestart={handleRestart}
                />
                {activeVideoUrl ? (
                  <video
                    key={activeVideoUrl}
                    ref={controllerVideoRef}
                    src={activeVideoUrl}
                    preload="metadata"
                    loop={activeSlideVideoLoop}
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      opacity: 0,
                      pointerEvents: 'none'
                    }}
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                      const nextDuration = e.currentTarget.duration
                      const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0
                      setDuration(safeDuration)
                      if (controllerVideoRef.current) {
                        controllerVideoRef.current.volume = volume
                      }
                    }}
                    onDurationChange={(e) => {
                      const nextDuration = e.currentTarget.duration
                      if (Number.isFinite(nextDuration) && nextDuration > 0) {
                        setDuration(nextDuration)
                      }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleControllerTimeUpdate}
                    onEnded={handleControllerEnded}
                    onVolumeChange={(e) => {
                      setVolume(e.currentTarget.volume)
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}