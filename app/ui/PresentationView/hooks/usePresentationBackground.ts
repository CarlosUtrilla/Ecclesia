import { useEffect, useState } from 'react'
import { ThemeWithMedia } from '../types'

type MediaType = 'image' | 'video' | 'color' | 'gradient'

type UsePresentationBackgroundParams = {
  theme: ThemeWithMedia
  buildMediaUrl: (path: string) => string
}

function getMediaType(background: string): MediaType {
  if (!background || background === 'media') return 'color'
  if (background.includes('gradient')) return 'gradient'
  return 'color'
}

export function usePresentationBackground({
  theme,
  buildMediaUrl
}: UsePresentationBackgroundParams) {
  const [backgroundType, setBackgroundType] = useState<MediaType>('color')
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string>('')

  const background = theme.background
  const backgroundMedia = theme.backgroundMedia
  const backgroundMediaType = backgroundMedia?.type
  const backgroundMediaFilePath = backgroundMedia?.filePath
  const backgroundMediaThumbnail = backgroundMedia?.thumbnail
  const backgroundMediaFallback = backgroundMedia?.fallback
  const hasBackgroundMedia = Boolean(backgroundMedia)

  useEffect(() => {
    if (!hasBackgroundMedia || background !== 'media') {
      setBackgroundUrl(background)
      setThumbnailUrl(null)
      setFallbackUrl(null)
      setBackgroundType(getMediaType(background))
      return
    }

    if (!backgroundMediaFilePath) {
      setBackgroundUrl(background)
      setThumbnailUrl(null)
      setFallbackUrl(null)
      setBackgroundType('color')
      setVideoLoaded(false)
      setVideoError(false)
      return
    }

    setBackgroundType(backgroundMediaType === 'VIDEO' ? 'video' : 'image')
    setBackgroundUrl(buildMediaUrl(backgroundMediaFilePath))

    if (backgroundMediaType === 'VIDEO' && backgroundMediaThumbnail) {
      setThumbnailUrl(buildMediaUrl(backgroundMediaThumbnail))
    } else {
      setThumbnailUrl(null)
    }

    if (backgroundMediaFallback) {
      setFallbackUrl(buildMediaUrl(backgroundMediaFallback))
    } else {
      setFallbackUrl(null)
    }

    setVideoLoaded(false)
    setVideoError(false)
  }, [
    background,
    hasBackgroundMedia,
    backgroundMediaType,
    backgroundMediaFilePath,
    backgroundMediaThumbnail,
    backgroundMediaFallback,
    buildMediaUrl
  ])

  return {
    background,
    backgroundType,
    backgroundUrl,
    thumbnailUrl,
    fallbackUrl,
    videoError,
    videoLoaded,
    setVideoLoaded,
    setVideoError
  }
}
