import { memo, useMemo, useRef } from 'react'
import { type Variants } from 'framer-motion'
import { cn } from '../../lib/utils'
import { PresentationViewProps } from './types'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { useMediaServer } from '@/contexts/MediaServerContext'
import useTagSongs from '@/hooks/useTagSongs'
import { usePresentationSizing } from './hooks/usePresentationSizing'
import { usePresentationBackground } from './hooks/usePresentationBackground'
import { usePresentationTextLayout } from './hooks/usePresentationTextLayout'
import { parseAnimationSettings } from './utils/parseAnimationSettings'
import { LiveThemeTransitionShell } from './components/LiveThemeTransitionShell'
import { PresentationBody } from './components/PresentationBody'

const EMPTY_ANIMATION_VARIANTS: Variants = {
  initial: {},
  animate: {},
  exit: {}
}

function PresentationViewComponent({
  items,
  theme,
  live = false,
  maxHeight,
  presentationHeight,
  currentIndex = 0,
  themeTransitionKey,
  onClick,
  selected,
  tagSongId,
  className,
  style,
  displayId,
  showTextBounds = false,
  textBoundsIsSelected = true,
  bibleVerseIsSelected = false,
  onTextBoundsChange,
  onBibleVersePositionChange,
  onEditableTargetSelect
}: PresentationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { tagSongs } = useTagSongs()
  const { buildMediaUrl } = useMediaServer()
  const { screenSize } = usePresentationSizing({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    live,
    presentationHeight,
    maxHeight,
    displayId
  })

  const {
    background,
    backgroundType,
    backgroundUrl,
    thumbnailUrl,
    fallbackUrl,
    videoError,
    videoLoaded,
    setVideoLoaded,
    setVideoError
  } = usePresentationBackground({ theme, buildMediaUrl })

  const currentItem = items[currentIndex] ?? items[0]
  const isMediaItem = currentItem?.resourceType === 'MEDIA'

  const animationSettings = useMemo<AnimationSettings>(() => {
    if (!live) return defaultAnimationSettings
    return parseAnimationSettings(theme.animationSettings)
  }, [live, theme.animationSettings])

  const animationType = (live ? animationSettings.type || 'fade' : 'none') as AnimationType

  const {
    calculatedSmallFontSize,
    scaleFactor,
    verticalAlign,
    textStyle,
    textContainerPadding,
    textContainerOffset,
    textBoundsScale,
    textBoundsBaseValues
  } = usePresentationTextLayout({ theme, screenSize })

  const variants = useMemo(
    () =>
      live
        ? getAnimationVariants(
            animationType,
            animationSettings.duration,
            animationSettings.delay,
            animationSettings.easing
          )
        : EMPTY_ANIMATION_VARIANTS,
    [
      live,
      animationType,
      animationSettings.duration,
      animationSettings.delay,
      animationSettings.easing
    ]
  )

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      aspectRatio: screenSize.aspectRatio,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
      background:
        backgroundType === 'color' || backgroundType === 'gradient' ? background : 'transparent',
      ...style
    }),
    [screenSize.aspectRatio, background, backgroundType, style]
  )

  const tagSong = useMemo(() => {
    if (tagSongId === undefined) return null
    return tagSongs.find((tag) => tag.id === tagSongId) || null
  }, [tagSongId, tagSongs])

  if (!currentItem) return null

  const viewContent = (
    <PresentationBody
      live={live}
      currentItem={currentItem}
      isMediaItem={isMediaItem}
      backgroundType={backgroundType}
      backgroundUrl={backgroundUrl}
      thumbnailUrl={thumbnailUrl}
      fallbackUrl={fallbackUrl}
      videoLoaded={videoLoaded}
      videoError={videoError}
      setVideoLoaded={setVideoLoaded}
      setVideoError={setVideoError}
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      onClick={onClick}
      hasTagSong={tagSong !== null}
      containerStyle={containerStyle}
      tagSong={tagSong}
      animationType={animationType}
      variants={variants}
      textStyle={textStyle}
      theme={theme}
      calculatedSmallFontSize={calculatedSmallFontSize}
      textContainerPadding={textContainerPadding}
      textContainerOffset={textContainerOffset}
      verticalAlign={verticalAlign}
      scaleFactor={scaleFactor}
      presentationHeight={screenSize.height}
      showTextBounds={showTextBounds}
      textBoundsIsSelected={textBoundsIsSelected}
      bibleVerseIsSelected={bibleVerseIsSelected}
      textBoundsBaseValues={textBoundsBaseValues}
      textBoundsScale={textBoundsScale}
      onTextBoundsChange={onTextBoundsChange}
      onBibleVersePositionChange={onBibleVersePositionChange}
      onEditableTargetSelect={onEditableTargetSelect}
      currentIndex={currentIndex}
    />
  )

  if (!live) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: screenSize.aspectRatio
        }}
        className={cn(
          'relative w-full h-full overflow-hidden',
          {
            'outline-[3px] outline-secondary transition-colors': selected,
            'cursor-pointer': onClick !== undefined,
            'rounded-md': true
          },
          className
        )}
      >
        {viewContent}
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: screenSize.aspectRatio
      }}
      className={cn(
        'relative w-full h-full overflow-hidden',
        {
          'outline-[3px] outline-secondary transition-colors': selected,
          'cursor-pointer': onClick !== undefined,
          'rounded-md': !live
        },
        className
      )}
    >
      <LiveThemeTransitionShell
        themeTransitionRaw={(theme as { transitionSettings?: string }).transitionSettings}
        themeTransitionKey={themeTransitionKey}
        themeId={theme.id}
      >
        {viewContent}
      </LiveThemeTransitionShell>
    </div>
  )
}

function arePresentationViewPropsEqual(
  prevProps: PresentationViewProps,
  nextProps: PresentationViewProps
) {
  return (
    prevProps.live === nextProps.live &&
    prevProps.maxHeight === nextProps.maxHeight &&
    prevProps.presentationHeight === nextProps.presentationHeight &&
    prevProps.currentIndex === nextProps.currentIndex &&
    prevProps.themeTransitionKey === nextProps.themeTransitionKey &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.selected === nextProps.selected &&
    prevProps.tagSongId === nextProps.tagSongId &&
    prevProps.className === nextProps.className &&
    prevProps.displayId === nextProps.displayId &&
    prevProps.style === nextProps.style &&
    prevProps.showTextBounds === nextProps.showTextBounds &&
    prevProps.textBoundsIsSelected === nextProps.textBoundsIsSelected &&
    prevProps.bibleVerseIsSelected === nextProps.bibleVerseIsSelected &&
    prevProps.onTextBoundsChange === nextProps.onTextBoundsChange &&
    prevProps.onBibleVersePositionChange === nextProps.onBibleVersePositionChange &&
    prevProps.onEditableTargetSelect === nextProps.onEditableTargetSelect &&
    prevProps.items === nextProps.items &&
    prevProps.theme === nextProps.theme
  )
}

export const PresentationView = memo(PresentationViewComponent, arePresentationViewPropsEqual)
