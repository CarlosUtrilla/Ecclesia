import { useCallback, useMemo, useState } from 'react'
import { ThemeWithMedia } from '../types'

type MediaType = 'image' | 'video' | 'color' | 'gradient'

type UsePresentationBackgroundParams = {
  theme: ThemeWithMedia
  buildMediaUrl: (path: string) => string
}

function getSolidBackgroundType(background: string): MediaType {
  if (!background || background === 'media') return 'color'
  if (background.includes('gradient')) return 'gradient'
  return 'color'
}

export function usePresentationBackground({
  theme,
  buildMediaUrl
}: UsePresentationBackgroundParams) {
  const background = theme.background
  const backgroundMedia = theme.backgroundMedia
  const backgroundMediaType = backgroundMedia?.type
  const backgroundMediaFilePath = backgroundMedia?.filePath
  const backgroundMediaThumbnail = backgroundMedia?.thumbnail
  const backgroundMediaFallback = backgroundMedia?.fallback
  const hasBackgroundMedia = Boolean(backgroundMedia)

  // Se deriva en el render, no en un `useEffect`. Resolviendolo por efecto, el
  // primer frame de la capa salia con `backgroundType: 'color'` y sin URL: en
  // una transicion de tema esa capa entra pintando el color del frame (negro en
  // modo oscuro) hasta que el efecto corre. Ese era el negro que se colaba en
  // el cross.
  const resolved = useMemo(() => {
    if (!hasBackgroundMedia || background !== 'media' || !backgroundMediaFilePath) {
      return {
        backgroundType: getSolidBackgroundType(background),
        backgroundUrl: background,
        thumbnailUrl: null as string | null,
        fallbackUrl: null as string | null
      }
    }

    return {
      backgroundType: (backgroundMediaType === 'VIDEO' ? 'video' : 'image') as MediaType,
      backgroundUrl: buildMediaUrl(backgroundMediaFilePath),
      thumbnailUrl:
        backgroundMediaType === 'VIDEO' && backgroundMediaThumbnail
          ? buildMediaUrl(backgroundMediaThumbnail)
          : null,
      fallbackUrl: backgroundMediaFallback ? buildMediaUrl(backgroundMediaFallback) : null
    }
  }, [
    background,
    hasBackgroundMedia,
    backgroundMediaType,
    backgroundMediaFilePath,
    backgroundMediaThumbnail,
    backgroundMediaFallback,
    buildMediaUrl
  ])

  const { backgroundType, backgroundUrl, thumbnailUrl, fallbackUrl } = resolved

  // El estado de carga se ata a la URL en vez de resetearse por efecto: asi no
  // queda ningun frame arrastrando el `videoLoaded` del fondo anterior.
  const [loadedVideoUrl, setLoadedVideoUrl] = useState<string | null>(null)
  const [erroredVideoUrl, setErroredVideoUrl] = useState<string | null>(null)

  const isVideoBackground = backgroundType === 'video'
  const videoLoaded = isVideoBackground && loadedVideoUrl === backgroundUrl
  const videoError = isVideoBackground && erroredVideoUrl === backgroundUrl

  const setVideoLoaded = useCallback(
    (value: boolean) => setLoadedVideoUrl(value ? backgroundUrl : null),
    [backgroundUrl]
  )

  const setVideoError = useCallback(
    (value: boolean) => setErroredVideoUrl(value ? backgroundUrl : null),
    [backgroundUrl]
  )

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
