import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
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
import useTagSongs from '@/hooks/useTagSongs'
import { useResizeObserver } from 'usehooks-ts'
import MediaRender from './components/MediaRender'

type MediaType = 'image' | 'video' | 'color' | 'gradient'

function getMediaType(background: string): MediaType {
  if (!background || background === 'media') return 'color'
  if (background.includes('gradient')) return 'gradient'
  return 'color'
}

export function PresentationView({
  items,
  theme,
  live = false,
  currentIndex = 0,
  onClick,
  selected,
  tagSongId,
  className,
  style,
  displayId,
  showTextBounds = false
}: PresentationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { tagSongs } = useTagSongs()
  const { buildMediaUrl } = useMediaServer()
  const { height } = useResizeObserver({
    ref: containerRef as React.RefObject<HTMLDivElement>
  })
  const screenSize = useScreenSize(height || 0, displayId)

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

  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(theme.animationSettings || '{}')
    } catch {
      return defaultAnimationSettings
    }
  }, [theme.animationSettings])

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

  const calculatedTextPadding = useMemo(() => {
    const horizontalValue = Number(theme.textStyle?.paddingInline ?? 16)
    const verticalValue = Number(theme.textStyle?.paddingBlock ?? 16)
    const horizontal = Number.isFinite(horizontalValue)
      ? (screenSize.width * horizontalValue) / BASE_PRESENTATION_WIDTH
      : 16
    const vertical = Number.isFinite(verticalValue)
      ? (screenSize.height * verticalValue) / BASE_PRESENTATION_HEIGHT
      : 16

    return {
      horizontal,
      vertical
    }
  }, [
    theme.textStyle?.paddingInline,
    theme.textStyle?.paddingBlock,
    screenSize.height,
    screenSize.width
  ])

  const textStyleConfig = (theme.textStyle || {}) as Record<string, unknown>
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

  const textStyle = useMemo(() => {
    const restTextStyle = { ...(theme.textStyle || {}) } as Record<string, unknown>
    delete restTextStyle.paddingInline
    delete restTextStyle.paddingBlock
    delete restTextStyle.translate

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

  if (!currentItem) return null

  return (
    <LazyMotion features={domAnimation}>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
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

        <AnimatePresence mode="wait">
          <AnimatedText
            item={currentItem}
            animationType={animationType}
            variants={variants}
            textStyle={textStyle}
            isPreview={!live}
            theme={theme}
            smallFontSize={calculatedSmallFontSize}
            textContainerPadding={calculatedTextPadding}
            textContainerOffset={calculatedTextOffset}
            scaleFactor={scaleFactor}
            showTextBounds={showTextBounds}
          />
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
    </LazyMotion>
  )
}
