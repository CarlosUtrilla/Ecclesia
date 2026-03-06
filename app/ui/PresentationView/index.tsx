import { memo, useMemo, useRef } from 'react'
import { type Variants } from 'framer-motion'
import { cn } from '../../lib/utils'
import { PresentationViewProps } from './types'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { BlankTheme } from '@/hooks/useThemes'
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
  presentationVerseBySlideKey,
  themeTransitionKey,
  hideTextInLive = false,
  onClick,
  selected,
  tagSongId,
  className,
  style,
  displayId,
  customAspectRatio,
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
    displayId,
    customAspectRatio
  })

  const currentItem = items[currentIndex] ?? items[0]
  const previewVerseRangeBadge = useMemo(() => {
    if (live || !currentItem) return null

    if (
      currentItem.verse &&
      currentItem.verse.verseEnd !== undefined &&
      currentItem.verse.verseEnd > currentItem.verse.verse
    ) {
      return `v${currentItem.verse.verse}-${currentItem.verse.verseEnd}`
    }

    if (
      currentItem.resourceType === 'PRESENTATION' &&
      Array.isArray(currentItem.presentationItems)
    ) {
      const rangedLayer = currentItem.presentationItems.find(
        (layer) =>
          layer.verse &&
          layer.verse.verseEnd !== undefined &&
          layer.verse.verseEnd > layer.verse.verse
      )

      if (rangedLayer?.verse) {
        return `v${rangedLayer.verse.verse}-${rangedLayer.verse.verseEnd}`
      }
    }

    return null
  }, [currentItem, live])
  const isMediaItem = currentItem?.resourceType === 'MEDIA'
  const slideTheme =
    currentItem?.resourceType === 'PRESENTATION' && currentItem && 'theme' in currentItem
      ? (currentItem as { theme?: typeof theme }).theme
      : undefined
  const effectiveTheme =
    slideTheme || (currentItem?.resourceType === 'PRESENTATION' ? BlankTheme : theme)

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
  } = usePresentationBackground({ theme: effectiveTheme, buildMediaUrl })

  const animationSettings = useMemo<AnimationSettings>(() => {
    if (!live) return defaultAnimationSettings
    return parseAnimationSettings(effectiveTheme.animationSettings)
  }, [live, effectiveTheme.animationSettings])

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
  } = usePresentationTextLayout({ theme: effectiveTheme, screenSize })

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
      theme={effectiveTheme}
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
      presentationVerseBySlideKey={presentationVerseBySlideKey}
      hideTextInLive={hideTextInLive}
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
        {previewVerseRangeBadge ? (
          <div className="pointer-events-none absolute right-1.5 top-1.5 rounded-sm border border-border/60 bg-background/85 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground">
            {previewVerseRangeBadge}
          </div>
        ) : null}
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
        themeTransitionRaw={(effectiveTheme as { transitionSettings?: string }).transitionSettings}
        themeTransitionKey={themeTransitionKey}
        themeId={effectiveTheme.id}
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
    prevProps.presentationVerseBySlideKey === nextProps.presentationVerseBySlideKey &&
    prevProps.themeTransitionKey === nextProps.themeTransitionKey &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.selected === nextProps.selected &&
    prevProps.tagSongId === nextProps.tagSongId &&
    prevProps.className === nextProps.className &&
    prevProps.displayId === nextProps.displayId &&
    prevProps.customAspectRatio === nextProps.customAspectRatio &&
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
