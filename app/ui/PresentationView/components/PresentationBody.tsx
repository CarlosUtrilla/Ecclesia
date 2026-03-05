import { memo, type RefObject } from 'react'
import { getContrastTextColor } from '@/lib/utils'
import { PresentationViewProps } from '../types'
import { AnimationType } from '@/lib/animations'
import { ResourceContent } from './ResourceContent'
import { LiveSlideTransitionShell } from './LiveSlideTransitionShell'
import MediaRender from './MediaRender'
import { BackgroundImage } from './BackgroundImage'
import { BackgroundVideoLive } from './BackgroundVideoLive'
import { PresentationFrame } from './PresentationFrame'
import { type Variants } from 'framer-motion'

type Props = {
  live: boolean
  currentItem: PresentationViewProps['items'][number]
  isMediaItem: boolean
  backgroundType: 'image' | 'video' | 'color' | 'gradient'
  backgroundUrl: string
  thumbnailUrl: string | null
  fallbackUrl: string | null
  videoLoaded: boolean
  videoError: boolean
  setVideoLoaded: (value: boolean) => void
  setVideoError: (value: boolean) => void
  containerRef: RefObject<HTMLDivElement>
  onClick: PresentationViewProps['onClick']
  hasTagSong: boolean
  containerStyle: React.CSSProperties
  tagSong: { color: string; name: string } | null
  animationType: AnimationType
  variants: Variants
  textStyle: React.CSSProperties
  theme: PresentationViewProps['theme']
  calculatedSmallFontSize: string
  textContainerPadding: {
    horizontal: number
    vertical: number
  }
  textContainerOffset: {
    x: number
    y: number
  }
  verticalAlign: 'top' | 'center' | 'bottom'
  scaleFactor: number
  presentationHeight: number
  showTextBounds: boolean
  textBoundsIsSelected: boolean
  bibleVerseIsSelected: boolean
  textBoundsBaseValues: {
    paddingInline: number
    paddingBlock: number
    translateX: number
    translateY: number
  }
  textBoundsScale: {
    x: number
    y: number
  }
  onTextBoundsChange: PresentationViewProps['onTextBoundsChange']
  onBibleVersePositionChange: PresentationViewProps['onBibleVersePositionChange']
  onEditableTargetSelect: PresentationViewProps['onEditableTargetSelect']
  currentIndex: number
  presentationVerseBySlideKey?: Record<string, number>
}

function PresentationBodyComponent({
  live,
  currentItem,
  isMediaItem,
  backgroundType,
  backgroundUrl,
  thumbnailUrl,
  fallbackUrl,
  videoLoaded,
  videoError,
  setVideoLoaded,
  setVideoError,
  containerRef,
  onClick,
  hasTagSong,
  containerStyle,
  tagSong,
  animationType,
  variants,
  textStyle,
  theme,
  calculatedSmallFontSize,
  textContainerPadding,
  textContainerOffset,
  verticalAlign,
  scaleFactor,
  presentationHeight,
  showTextBounds,
  textBoundsIsSelected,
  bibleVerseIsSelected,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  onBibleVersePositionChange,
  onEditableTargetSelect,
  currentIndex,
  presentationVerseBySlideKey
}: Props) {
  const backgroundLayer = !isMediaItem ? (
    <>
      {backgroundType === 'image' && backgroundUrl ? (
        live ? (
          <BackgroundImage url={backgroundUrl} />
        ) : (
          <img
            src={backgroundUrl}
            alt="Background"
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0
            }}
          />
        )
      ) : null}

      {backgroundType === 'video' &&
        (live ? (
          <BackgroundVideoLive
            videoUrl={backgroundUrl}
            fallbackUrl={fallbackUrl}
            isVideoLoaded={videoLoaded}
            hasError={videoError}
            onVideoLoaded={() => setVideoLoaded(true)}
            onVideoError={() => setVideoError(true)}
          />
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0
            }}
          />
        ) : null)}
    </>
  ) : null

  const mainContent = (
    <>
      {isMediaItem ? <MediaRender currentItem={currentItem} live={live} /> : null}

      <ResourceContent
        currentItem={currentItem}
        isLive={live}
        currentIndex={currentIndex}
        presentationVerseBySlideKey={presentationVerseBySlideKey}
        animationType={animationType}
        variants={variants}
        textStyle={textStyle}
        theme={theme}
        calculatedSmallFontSize={calculatedSmallFontSize}
        textContainerPadding={textContainerPadding}
        textContainerOffset={textContainerOffset}
        verticalAlign={verticalAlign}
        scaleFactor={scaleFactor}
        presentationHeight={presentationHeight}
        showTextBounds={showTextBounds}
        textBoundsIsSelected={textBoundsIsSelected}
        bibleVerseIsSelected={bibleVerseIsSelected}
        textBoundsBaseValues={textBoundsBaseValues}
        textBoundsScale={textBoundsScale}
        onTextBoundsChange={onTextBoundsChange}
        onBibleVersePositionChange={onBibleVersePositionChange}
        onEditableTargetSelect={onEditableTargetSelect}
      />
    </>
  )

  const contentLayer = live ? (
    <LiveSlideTransitionShell
      slideTransitionRaw={currentItem.transitionSettings}
      slideKey={currentItem.id || `slide-${currentIndex}`}
    >
      {mainContent}
    </LiveSlideTransitionShell>
  ) : (
    <div className="absolute inset-0">{mainContent}</div>
  )

  const tagSongLayer =
    tagSong !== null ? (
      <div
        style={{
          backgroundColor: tagSong.color,
          color: getContrastTextColor(tagSong.color)
        }}
        className="absolute flex items-center bottom-0 h-7 w-full text-[0.8rem] px-3"
      >
        {tagSong.name}
      </div>
    ) : null

  return (
    <PresentationFrame
      ref={containerRef}
      onClick={onClick}
      hasTagSong={hasTagSong}
      containerStyle={containerStyle}
      backgroundLayer={backgroundLayer}
      contentLayer={contentLayer}
      tagSongLayer={tagSongLayer}
    />
  )
}

function arePresentationBodyPropsEqual(prevProps: Props, nextProps: Props) {
  return (
    prevProps.live === nextProps.live &&
    prevProps.currentItem === nextProps.currentItem &&
    prevProps.isMediaItem === nextProps.isMediaItem &&
    prevProps.backgroundType === nextProps.backgroundType &&
    prevProps.backgroundUrl === nextProps.backgroundUrl &&
    prevProps.thumbnailUrl === nextProps.thumbnailUrl &&
    prevProps.fallbackUrl === nextProps.fallbackUrl &&
    prevProps.videoLoaded === nextProps.videoLoaded &&
    prevProps.videoError === nextProps.videoError &&
    prevProps.setVideoLoaded === nextProps.setVideoLoaded &&
    prevProps.setVideoError === nextProps.setVideoError &&
    prevProps.containerRef === nextProps.containerRef &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.hasTagSong === nextProps.hasTagSong &&
    prevProps.containerStyle === nextProps.containerStyle &&
    prevProps.tagSong === nextProps.tagSong &&
    prevProps.animationType === nextProps.animationType &&
    prevProps.variants === nextProps.variants &&
    prevProps.textStyle === nextProps.textStyle &&
    prevProps.theme === nextProps.theme &&
    prevProps.calculatedSmallFontSize === nextProps.calculatedSmallFontSize &&
    prevProps.textContainerPadding.horizontal === nextProps.textContainerPadding.horizontal &&
    prevProps.textContainerPadding.vertical === nextProps.textContainerPadding.vertical &&
    prevProps.textContainerOffset.x === nextProps.textContainerOffset.x &&
    prevProps.textContainerOffset.y === nextProps.textContainerOffset.y &&
    prevProps.verticalAlign === nextProps.verticalAlign &&
    prevProps.scaleFactor === nextProps.scaleFactor &&
    prevProps.presentationHeight === nextProps.presentationHeight &&
    prevProps.showTextBounds === nextProps.showTextBounds &&
    prevProps.textBoundsIsSelected === nextProps.textBoundsIsSelected &&
    prevProps.bibleVerseIsSelected === nextProps.bibleVerseIsSelected &&
    prevProps.textBoundsBaseValues === nextProps.textBoundsBaseValues &&
    prevProps.textBoundsScale === nextProps.textBoundsScale &&
    prevProps.onTextBoundsChange === nextProps.onTextBoundsChange &&
    prevProps.onBibleVersePositionChange === nextProps.onBibleVersePositionChange &&
    prevProps.onEditableTargetSelect === nextProps.onEditableTargetSelect &&
    prevProps.currentIndex === nextProps.currentIndex &&
    prevProps.presentationVerseBySlideKey === nextProps.presentationVerseBySlideKey
  )
}

export const PresentationBody = memo(PresentationBodyComponent, arePresentationBodyPropsEqual)
