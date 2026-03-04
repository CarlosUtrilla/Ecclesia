import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion'
import { cn, getContrastTextColor } from '../../lib/utils'
import { PresentationViewProps } from './types'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { BackgroundImage } from './components/BackgroundImage'
import { BackgroundVideoThumbnail } from './components/BackgroundVideoThumbnail'
import { BackgroundVideoLive } from './components/BackgroundVideoLive'
import { AnimatedText } from './components/AnimatedText'
import { BibleTextRender } from './components/BibleTextRender'
import PresentationRender from './components/PresentationRender'
import useTagSongs from '@/hooks/useTagSongs'
import { useResizeObserver } from 'usehooks-ts'
import MediaRender from './components/MediaRender'

type MediaType = 'image' | 'video' | 'color' | 'gradient'

function getMediaType(background: string): MediaType {
  if (!background || background === 'media') return 'color'
  if (background.includes('gradient')) return 'gradient'
  return 'color'
}

const parseAnimationSettings = (raw?: string): AnimationSettings => {
  try {
    return {
      ...defaultAnimationSettings,
      ...(raw ? JSON.parse(raw) : {})
    }
  } catch {
    return defaultAnimationSettings
  }
}

export function PresentationView({
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
  const [lastMeasuredHeight, setLastMeasuredHeight] = useState(0)
  const { tagSongs } = useTagSongs()
  const { buildMediaUrl } = useMediaServer()
  const { height = 0 } = useResizeObserver({
    ref: containerRef as React.RefObject<HTMLElement>,
    box: 'border-box'
  })

  useEffect(() => {
    if (height > 0) {
      setLastMeasuredHeight((prev) => (prev !== height ? height : prev))
      return
    }

    if (!live || lastMeasuredHeight > 0) return

    let frameId = 0
    const measureUntilReady = () => {
      const nextHeight = containerRef.current?.getBoundingClientRect().height ?? 0
      if (nextHeight > 0) {
        setLastMeasuredHeight((prev) => (prev !== nextHeight ? nextHeight : prev))
        return
      }
      frameId = requestAnimationFrame(measureUntilReady)
    }

    frameId = requestAnimationFrame(measureUntilReady)
    return () => cancelAnimationFrame(frameId)
  }, [height, live, lastMeasuredHeight])

  const measuredHeight = height > 0 ? height : lastMeasuredHeight
  const effectiveHeight = measuredHeight || presentationHeight || maxHeight || 0
  const screenSize = useScreenSize(effectiveHeight, displayId)

  const [backgroundType, setBackgroundType] = useState<MediaType>('color')
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string>('')

  const currentItem = items[currentIndex] ?? items[0]
  const background = theme.background
  const backgroundMedia = theme.backgroundMedia

  useEffect(() => {
    if (!backgroundMedia || background !== 'media') {
      setBackgroundUrl(background)
      setThumbnailUrl(null)
      setFallbackUrl(null)
      setBackgroundType(getMediaType(background))
      return
    }

    setBackgroundType(backgroundMedia.type === 'VIDEO' ? 'video' : 'image')
    setBackgroundUrl(buildMediaUrl(backgroundMedia.filePath))

    if (backgroundMedia.type === 'VIDEO' && backgroundMedia.thumbnail) {
      setThumbnailUrl(buildMediaUrl(backgroundMedia.thumbnail))
    } else {
      setThumbnailUrl(null)
    }

    if (backgroundMedia.fallback) {
      setFallbackUrl(buildMediaUrl(backgroundMedia.fallback))
    } else {
      setFallbackUrl(null)
    }

    setVideoLoaded(false)
    setVideoError(false)
  }, [background, backgroundMedia, buildMediaUrl])

  const animationSettings = useMemo<AnimationSettings>(
    () => parseAnimationSettings(theme.animationSettings),
    [theme.animationSettings]
  )

  const animationType = (animationSettings.type || 'fade') as AnimationType

  const calculatedFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * Number(theme.textStyle.fontSize)) / BASE_PRESENTATION_HEIGHT}px`
    : 'inherit'

  const calculatedSmallFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * (Number(theme.textStyle.fontSize) * 0.85)) / BASE_PRESENTATION_HEIGHT}px`
    : 'inherit'

  const scaleFactor = useMemo(() => {
    const factor = screenSize.height / BASE_PRESENTATION_HEIGHT
    return Number.isFinite(factor) && factor > 0 ? factor : 1
  }, [screenSize.height])

  const basePaddingInline = Number(theme.textStyle?.paddingInline ?? 16)
  const basePaddingBlock = Number(theme.textStyle?.paddingBlock ?? 16)

  const safePaddingInline = Number.isFinite(basePaddingInline) ? basePaddingInline : 16
  const safePaddingBlock = Number.isFinite(basePaddingBlock) ? basePaddingBlock : 16

  const calculatedTextPadding = useMemo(() => {
    const horizontal = Number.isFinite(safePaddingInline)
      ? (screenSize.width * safePaddingInline) / BASE_PRESENTATION_WIDTH
      : 16
    const vertical = Number.isFinite(safePaddingBlock)
      ? (screenSize.height * safePaddingBlock) / BASE_PRESENTATION_HEIGHT
      : 16

    return {
      horizontal,
      vertical
    }
  }, [safePaddingInline, safePaddingBlock, screenSize.height, screenSize.width])

  const textStyleConfig = (theme.textStyle || {}) as Record<string, unknown>
  const justifyContentRaw =
    typeof textStyleConfig.justifyContent === 'string' ? textStyleConfig.justifyContent : 'center'
  const verticalAlign: 'top' | 'center' | 'bottom' =
    justifyContentRaw === 'flex-start'
      ? 'top'
      : justifyContentRaw === 'flex-end'
        ? 'bottom'
        : 'center'
  const translateRaw =
    typeof textStyleConfig.translate === 'string' ? textStyleConfig.translate : ''
  const translateParts = translateRaw.trim().split(/\s+/)
  const translateXValue = Number.parseFloat(translateParts[0] || '0')
  const translateYValue = Number.parseFloat(translateParts[1] || translateParts[0] || '0')

  const calculatedTextOffset = useMemo(() => {
    const x = Number.isFinite(translateXValue)
      ? (screenSize.width * translateXValue) / BASE_PRESENTATION_WIDTH
      : 0
    const y = Number.isFinite(translateYValue)
      ? (screenSize.height * translateYValue) / BASE_PRESENTATION_HEIGHT
      : 0
    return { x, y }
  }, [screenSize.height, screenSize.width, translateXValue, translateYValue])

  const boundsScale = useMemo(
    () => ({
      x: screenSize.width / BASE_PRESENTATION_WIDTH,
      y: screenSize.height / BASE_PRESENTATION_HEIGHT
    }),
    [screenSize.width, screenSize.height]
  )

  const variants = useMemo(
    () =>
      getAnimationVariants(
        animationType,
        animationSettings.duration,
        animationSettings.delay,
        animationSettings.easing
      ),
    [animationType, animationSettings.duration, animationSettings.delay, animationSettings.easing]
  )

  const slideTransitionSettings = useMemo<AnimationSettings>(
    () => parseAnimationSettings(currentItem?.transitionSettings),
    [currentItem?.transitionSettings]
  )

  const slideTransitionType = (slideTransitionSettings.type || 'fade') as AnimationType

  const slideTransitionVariants = useMemo(
    () =>
      getAnimationVariants(
        slideTransitionType,
        slideTransitionSettings.duration,
        slideTransitionSettings.delay,
        slideTransitionSettings.easing
      ),
    [
      slideTransitionType,
      slideTransitionSettings.duration,
      slideTransitionSettings.delay,
      slideTransitionSettings.easing
    ]
  )

  const themeTransitionSettings = useMemo<AnimationSettings>(
    () => parseAnimationSettings((theme as { transitionSettings?: string }).transitionSettings),
    [theme]
  )

  const themeTransitionType = (themeTransitionSettings.type || 'fade') as AnimationType

  const resolvedThemeTransitionKey = themeTransitionKey ?? theme.id ?? 0

  const themeTransitionVariants = useMemo(
    () =>
      getAnimationVariants(
        themeTransitionType,
        themeTransitionSettings.duration,
        themeTransitionSettings.delay,
        themeTransitionSettings.easing
      ),
    [
      themeTransitionType,
      themeTransitionSettings.duration,
      themeTransitionSettings.delay,
      themeTransitionSettings.easing
    ]
  )

  const textStyle = useMemo(() => {
    const restTextStyle = { ...(theme.textStyle || {}) } as Record<string, unknown>
    delete restTextStyle.paddingInline
    delete restTextStyle.paddingBlock
    delete restTextStyle.translate
    delete restTextStyle.justifyContent

    return {
      ...restTextStyle,
      fontSize: calculatedFontSize
    }
  }, [theme.textStyle, calculatedFontSize])

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      aspectRatio: screenSize.aspectRatio,
      overflow: 'hidden',
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

  const nonBibleAnimatedItem = useMemo(
    () => ({
      ...currentItem,
      verse: undefined
    }),
    [currentItem]
  )

  if (!currentItem) return null

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        <m.div
          key={`theme-${resolvedThemeTransitionKey}`}
          variants={themeTransitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full h-full"
        >
          <div
            ref={containerRef}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={
              onClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onClick()
                    }
                  }
                : undefined
            }
            style={containerStyle}
            className={cn('border bg-background relative select-none', className, {
              'outline-4 outline-secondary transition-colors': selected,
              'cursor-pointer': onClick !== undefined,
              'border-0': live,
              'rounded-md': !live,
              'pb-7': tagSong !== null
            })}
          >
            <AnimatePresence mode="wait">
              <m.div
                key={currentItem.id || `slide-${currentIndex}`}
                variants={slideTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute inset-0"
              >
                <AnimatePresence>
                  {currentItem.resourceType === 'MEDIA' ? (
                    <MediaRender currentItem={currentItem} live={live} />
                  ) : (
                    <>
                      {backgroundType === 'image' && backgroundUrl && (
                        <BackgroundImage url={backgroundUrl} />
                      )}

                      {backgroundType === 'video' && !live && thumbnailUrl && (
                        <BackgroundVideoThumbnail thumbnailUrl={thumbnailUrl} />
                      )}
                      {backgroundType === 'video' && live && (
                        <BackgroundVideoLive
                          videoUrl={backgroundUrl}
                          fallbackUrl={fallbackUrl}
                          isVideoLoaded={videoLoaded}
                          hasError={videoError}
                          onVideoLoaded={() => setVideoLoaded(true)}
                          onVideoError={() => setVideoError(true)}
                        />
                      )}
                    </>
                  )}
                </AnimatePresence>

                {currentItem.resourceType === 'PRESENTATION' ? (
                  <PresentationRender
                    item={currentItem}
                    animationType={animationType}
                    variants={variants}
                    textStyle={textStyle}
                    isPreview={!live}
                    textContainerPadding={calculatedTextPadding}
                    textContainerOffset={calculatedTextOffset}
                    verticalAlign={verticalAlign}
                    showTextBounds={showTextBounds}
                    textBoundsIsSelected={textBoundsIsSelected}
                    textBoundsBaseValues={{
                      paddingInline: safePaddingInline,
                      paddingBlock: safePaddingBlock,
                      translateX: Number.isFinite(translateXValue) ? translateXValue : 0,
                      translateY: Number.isFinite(translateYValue) ? translateYValue : 0
                    }}
                    textBoundsScale={boundsScale}
                    onTextBoundsChange={onTextBoundsChange}
                    onEditableTargetSelect={onEditableTargetSelect}
                  />
                ) : currentItem.resourceType === 'BIBLE' ? (
                  <BibleTextRender
                    item={currentItem}
                    animationType={animationType}
                    variants={variants}
                    textStyle={textStyle}
                    isPreview={!live}
                    theme={theme}
                    smallFontSize={calculatedSmallFontSize}
                    textContainerPadding={calculatedTextPadding}
                    textContainerOffset={calculatedTextOffset}
                    verticalAlign={verticalAlign}
                    scaleFactor={scaleFactor}
                    presentationHeight={screenSize.height}
                    showTextBounds={showTextBounds}
                    textBoundsIsSelected={textBoundsIsSelected}
                    bibleVerseIsSelected={bibleVerseIsSelected}
                    textBoundsBaseValues={{
                      paddingInline: safePaddingInline,
                      paddingBlock: safePaddingBlock,
                      translateX: Number.isFinite(translateXValue) ? translateXValue : 0,
                      translateY: Number.isFinite(translateYValue) ? translateYValue : 0
                    }}
                    textBoundsScale={boundsScale}
                    onTextBoundsChange={onTextBoundsChange}
                    onBibleVersePositionChange={onBibleVersePositionChange}
                    onEditableTargetSelect={onEditableTargetSelect}
                  />
                ) : (
                  <AnimatedText
                    item={nonBibleAnimatedItem}
                    animationType={animationType}
                    variants={variants}
                    textStyle={textStyle}
                    isPreview={!live}
                    textContainerPadding={calculatedTextPadding}
                    textContainerOffset={calculatedTextOffset}
                    verticalAlign={verticalAlign}
                    showTextBounds={showTextBounds}
                    textBoundsIsSelected={textBoundsIsSelected}
                    textBoundsBaseValues={{
                      paddingInline: safePaddingInline,
                      paddingBlock: safePaddingBlock,
                      translateX: Number.isFinite(translateXValue) ? translateXValue : 0,
                      translateY: Number.isFinite(translateYValue) ? translateYValue : 0
                    }}
                    textBoundsScale={boundsScale}
                    onTextBoundsChange={onTextBoundsChange}
                    onEditableTargetSelect={onEditableTargetSelect}
                  />
                )}
              </m.div>
            </AnimatePresence>

            {tagSong !== null ? (
              <div
                style={{
                  backgroundColor: tagSong.color,
                  color: getContrastTextColor(tagSong.color)
                }}
                className="absolute flex items-center bottom-0 h-7 w-full text-[0.8rem] px-3"
              >
                {tagSong.name}
              </div>
            ) : null}
          </div>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
