import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { cn, getContrastTextColor } from '../../lib/utils'
import { PresentationViewProps } from './types'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { BackgroundImage } from './components/BackgroundImage'
import { BackgroundVideoThumbnail } from './components/BackgroundVideoThumbnail'
import { BackgroundVideoLive } from './components/BackgroundVideoLive'
import { AnimatedText } from './components/AnimatedText'

import useTagSongs from '@/hooks/useTagSongs'
import { useResizeObserver } from 'usehooks-ts'

// Tipos para backgrounds
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
  displayId
}: PresentationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { tagSongs } = useTagSongs()

  const { buildMediaUrl } = useMediaServer()
  const { height } = useResizeObserver({
    ref: containerRef as React.RefObject<HTMLDivElement>
  })
  const screenSize = useScreenSize(height || 0, displayId)
  console.log('Screen size:', screenSize)
  // Estados para manejar el background
  const [mediaType, setMediaType] = useState<MediaType>('color')
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string>('')

  // Obtener item actual y datos del theme
  const currentItem = items[currentIndex] ?? items[0]
  const background = theme.background
  const backgroundMedia = theme.backgroundMedia

  // Construir URLs y determinar tipo de media
  useEffect(() => {
    if (!backgroundMedia || background !== 'media') {
      setBackgroundUrl(background)
      setThumbnailUrl(null)
      setFallbackUrl(null)
      setMediaType(getMediaType(background))
      return
    }

    setMediaType(backgroundMedia.type === 'VIDEO' ? 'video' : 'image')
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
  }, [background, backgroundMedia, buildMediaUrl])

  // Reset video estado cuando cambia el background
  useEffect(() => {
    setVideoLoaded(false)
    setVideoError(false)
  }, [background, backgroundMedia])

  // Parse animation settings
  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(theme.animationSettings || '{}')
    } catch {
      return defaultAnimationSettings
    }
  }, [theme.animationSettings])

  const animationType = (animationSettings.type || 'fade') as AnimationType

  // Calcular font size proporcional
  const calculatedFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * Number(theme.textStyle.fontSize)) / 320}px`
    : 'inherit'

  const calculatedSmallFontSize = theme.textStyle?.fontSize
    ? `${(screenSize.height * (Number(theme.textStyle.fontSize) * 0.85)) / 320}px`
    : 'inherit'
  // Memoizar variants
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

  // Memoizar estilos
  const textStyle = useMemo(
    () => ({
      ...theme.textStyle,
      fontSize: calculatedFontSize
    }),
    [theme, calculatedFontSize]
  )

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      aspectRatio: screenSize.aspectRatio,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
      background: mediaType === 'color' || mediaType === 'gradient' ? background : 'transparent'
    }),
    [screenSize.aspectRatio, background, mediaType]
  )

  const tagSong = useMemo(() => {
    if (tagSongId === undefined) return null
    return tagSongs.find((tag) => tag.id === tagSongId) || null
  }, [tagSongId, tagSongs])

  if (!currentItem) return null

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onClick={onClick}
      style={containerStyle}
      className={cn('border bg-background relative select-none', className, {
        'outline-2 outline-primary transition-colors': selected,
        'cursor-pointer': onClick !== undefined,
        'border-0': live,
        'rounded-md': !live,
        'pb-7': tagSong !== null
      })}
    >
      {/* Fondos con transición cross-fade */}
      <AnimatePresence>
        {mediaType === 'image' && backgroundUrl && <BackgroundImage url={backgroundUrl} />}

        {mediaType === 'video' && !live && thumbnailUrl && (
          <BackgroundVideoThumbnail thumbnailUrl={thumbnailUrl} />
        )}

        {mediaType === 'video' && live && (
          <BackgroundVideoLive
            videoUrl={backgroundUrl}
            fallbackUrl={fallbackUrl}
            isVideoLoaded={videoLoaded}
            hasError={videoError}
            onVideoLoaded={() => setVideoLoaded(true)}
            onVideoError={() => setVideoError(true)}
          />
        )}
      </AnimatePresence>

      {/* Texto con animaciones */}
      <AnimatePresence mode="wait">
        <AnimatedText
          item={currentItem}
          animationType={animationType}
          variants={variants}
          textStyle={textStyle}
          isPreview={!live}
          theme={theme}
          smallFontSize={calculatedSmallFontSize}
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
  )
}
