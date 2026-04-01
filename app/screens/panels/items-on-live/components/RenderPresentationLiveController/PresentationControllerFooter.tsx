import { RefObject, SyntheticEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PresentationBibleTarget } from '@/lib/presentationBibleVersionOverrides'
import { Button } from '@/ui/button'
import BibleVersionSelector from '../BibleVersionSelector'
import VideoLiveControls from '../VideoLiveControls'
import { VerseController } from './VerseRangeController'
import VerseRangeController from './VerseRangeController'

type Props = {
  safeIndex: number
  totalSlides: number
  onPrevious: () => void
  onNext: () => void
  verseController: VerseController | null
  activePreviewSource?: PresentationBibleTarget
  activeSlideBibleVersion: string
  activeBookShortName: string
  onSetVerse: (nextVerse: number) => void
  activeSlideHasVideo: boolean
  isUpdatingBibleVersion: boolean
  onBibleVersionChange: (newVersion: number | string) => Promise<void>
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  onVolumeChange: (nextVolume: number) => void
  onSeek: (time: number) => void
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  activeVideoUrl: string | null
  activeSlideVideoLoop: boolean
  controllerVideoRef: RefObject<HTMLVideoElement | null>
  onHiddenVideoLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void
  onHiddenVideoDurationChange: (event: SyntheticEvent<HTMLVideoElement>) => void
  onControllerTimeUpdate: () => void
  onControllerEnded: () => void
  onHiddenVideoPlay: () => void
  onHiddenVideoPause: () => void
  onHiddenVideoVolumeChange: (event: SyntheticEvent<HTMLVideoElement>) => void
}

export default function PresentationControllerFooter({
  safeIndex,
  totalSlides,
  onPrevious,
  onNext,
  verseController,
  activePreviewSource,
  activeSlideBibleVersion,
  activeBookShortName,
  onSetVerse,
  activeSlideHasVideo,
  isUpdatingBibleVersion,
  onBibleVersionChange,
  isPlaying,
  currentTime,
  duration,
  volume,
  onVolumeChange,
  onSeek,
  onPlay,
  onPause,
  onRestart,
  activeVideoUrl,
  activeSlideVideoLoop,
  controllerVideoRef,
  onHiddenVideoLoadedMetadata,
  onHiddenVideoDurationChange,
  onControllerTimeUpdate,
  onControllerEnded,
  onHiddenVideoPlay,
  onHiddenVideoPause,
  onHiddenVideoVolumeChange
}: Props) {
  return (
    <div className="shrink-0 border-t bg-background/80 px-3 py-2 flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onPrevious}
        disabled={safeIndex <= 0 || totalSlides === 0}
      >
        <ChevronLeft className="size-4" />
        Anterior
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onNext}
        disabled={safeIndex >= totalSlides - 1 || totalSlides === 0}
      >
        Siguiente
        <ChevronRight className="size-4" />
      </Button>

      <div className="text-xs text-muted-foreground ml-2">
        Diapositiva {totalSlides === 0 ? 0 : safeIndex + 1} / {totalSlides}
        {verseController
          ? ` · ${verseController.mode === 'chunk' ? 'Parte' : 'Verso'} ${verseController.current}/${verseController.end}`
          : ''}
      </div>

      {verseController ? (
        <VerseRangeController
          className="ml-2"
          verseController={verseController}
          previewSource={activePreviewSource || null}
          bibleVersion={activeSlideBibleVersion}
          bookShortName={activeBookShortName}
          slideIndex={safeIndex}
          onSetVerse={onSetVerse}
        />
      ) : null}

      {activeSlideBibleVersion || activeSlideHasVideo ? (
        <div className="ml-auto flex items-center gap-2 min-w-0">
          {activeSlideBibleVersion ? (
            <BibleVersionSelector
              value={activeSlideBibleVersion}
              onValueChange={onBibleVersionChange}
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
                onVolumeChange={onVolumeChange}
                onSeek={onSeek}
                onPlay={onPlay}
                onPause={onPause}
                onRestart={onRestart}
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
                  onLoadedMetadata={onHiddenVideoLoadedMetadata}
                  onDurationChange={onHiddenVideoDurationChange}
                  onPlay={onHiddenVideoPlay}
                  onPause={onHiddenVideoPause}
                  onTimeUpdate={onControllerTimeUpdate}
                  onEnded={onControllerEnded}
                  onVolumeChange={onHiddenVideoVolumeChange}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
