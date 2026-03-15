import { useEffect, useRef, useState } from 'react'
import { ThemeWithMedia } from '../../ui/PresentationView/types'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { PresentationView } from '../../ui/PresentationView'
import { useParams } from 'react-router'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { MediaDto } from 'database/controllers/media/media.dto'
import { parseAnimationSettings } from '@/ui/PresentationView/utils/parseAnimationSettings'

const FALLBACK_MEDIA_KEY = 'LOGO_FALLBACK_MEDIA_ID'
const FALLBACK_COLOR_KEY = 'LOGO_FALLBACK_COLOR'

const getThemeTransitionSignature = (theme: ThemeWithMedia): string => {
  const backgroundMedia = theme.backgroundMedia

  return [
    theme.id ?? 'no-theme-id',
    theme.background ?? 'no-background',
    backgroundMedia?.type ?? 'no-media-type',
    backgroundMedia?.filePath ?? 'no-media-file',
    backgroundMedia?.thumbnail ?? 'no-thumbnail',
    backgroundMedia?.fallback ?? 'no-fallback'
  ].join('|')
}

export default function LiveScreen({ isPreview = false }: { isPreview?: boolean }) {
  const displayId = useParams().displayId
  const { buildMediaUrl } = useMediaServer()
  const shouldApplyFallback = !isPreview
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const hasLiveItem = (content?.content?.length ?? 0) > 0
  const [presentationVerseBySlideKey, setPresentationVerseBySlideKey] = useState<
    Record<string, number>
  >({})
  const [liveControls, setLiveControls] = useState({
    hideText: false,
    showLogo: false,
    blackScreen: false
  })
  const [themeKey, setThemeKey] = useState(0)
  const lastThemeTransitionSignatureRef = useRef(getThemeTransitionSignature(BlankTheme))

  const [fallbackColor, setFallbackColor] = useState('#000000')
  const [fallbackMedia, setFallbackMedia] = useState<MediaDto | null>(null)
  const [keepFallbackDuringThemeEnter, setKeepFallbackDuringThemeEnter] = useState(false)
  const hadLiveItemRef = useRef(false)
  const fallbackDelayTimeoutRef = useRef<number | null>(null)

  // Carga la configuración de logo/fallback al montar
  useEffect(() => {
    if (!shouldApplyFallback) return

    const loadFallbackSettings = async () => {
      try {
        const settings = await window.api.setttings.getSettings([
          FALLBACK_MEDIA_KEY as never,
          FALLBACK_COLOR_KEY as never
        ])
        const mediaIdValue = settings.find((s) => s.key === FALLBACK_MEDIA_KEY)?.value
        const colorValue = settings.find((s) => s.key === FALLBACK_COLOR_KEY)?.value

        if (colorValue) setFallbackColor(colorValue)

        if (mediaIdValue) {
          const parsed = parseInt(mediaIdValue)
          if (!isNaN(parsed)) {
            const mediaList = await window.api.media.getMediaByIds([parsed])
            setFallbackMedia(mediaList[0] ?? null)
          }
        }
      } catch {
        // Si falla la carga, se mantiene el negro por defecto
      }
    }

    loadFallbackSettings()
  }, [shouldApplyFallback])

  useEffect(() => {
    window.electron.ipcRenderer.send('renderer-ready')
    console.log('LiveScreen mounted, setting up IPC listeners')
    const unsuscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        console.log('Received live screen update:', data)
        if (typeof data.itemIndex === 'number') {
          setItemIndex(data.itemIndex)
        }

        if ('contentScreen' in data) {
          setContent(data.contentScreen ?? null)
        }

        if (data.presentationVerseBySlideKey !== undefined) {
          setPresentationVerseBySlideKey(data.presentationVerseBySlideKey)
        }

        if (data.liveControls) {
          setLiveControls((prev) => ({
            hideText: data.liveControls?.hideText ?? prev.hideText,
            showLogo: data.liveControls?.showLogo ?? prev.showLogo,
            blackScreen: data.liveControls?.blackScreen ?? prev.blackScreen
          }))
        }
      }
    )
    const unsuscribeThemes = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, data: ThemeWithMedia) => {
        console.log('Received live screen theme update:', data)
        setSelectedTheme(data)

        const nextSignature = getThemeTransitionSignature(data)
        if (lastThemeTransitionSignatureRef.current !== nextSignature) {
          lastThemeTransitionSignatureRef.current = nextSignature
          setThemeKey((prev) => prev + 1)
        }
      }
    )
    return () => {
      unsuscribeItems()
      unsuscribeThemes()
    }
  }, [])

  useEffect(() => {
    if (!shouldApplyFallback) return

    const hadLiveItem = hadLiveItemRef.current

    if (!hadLiveItem && hasLiveItem) {
      setKeepFallbackDuringThemeEnter(true)

      if (fallbackDelayTimeoutRef.current !== null) {
        window.clearTimeout(fallbackDelayTimeoutRef.current)
      }

      const themeTransition = parseAnimationSettings(
        (selectedTheme as { transitionSettings?: string }).transitionSettings
      )

      const totalTransitionMs = Math.max(
        0,
        Math.round((themeTransition.delay + themeTransition.duration) * 1000)
      )

      fallbackDelayTimeoutRef.current = window.setTimeout(() => {
        setKeepFallbackDuringThemeEnter(false)
        fallbackDelayTimeoutRef.current = null
      }, totalTransitionMs)
    }

    if (!hasLiveItem) {
      setKeepFallbackDuringThemeEnter(false)

      if (fallbackDelayTimeoutRef.current !== null) {
        window.clearTimeout(fallbackDelayTimeoutRef.current)
        fallbackDelayTimeoutRef.current = null
      }
    }

    hadLiveItemRef.current = hasLiveItem
  }, [hasLiveItem, selectedTheme, shouldApplyFallback])

  useEffect(() => {
    return () => {
      if (fallbackDelayTimeoutRef.current !== null) {
        window.clearTimeout(fallbackDelayTimeoutRef.current)
      }
    }
  }, [])

  const fallbackMediaUrl = fallbackMedia ? buildMediaUrl(fallbackMedia.filePath) : null
  const fallbackThumbnailUrl = fallbackMedia?.thumbnail
    ? buildMediaUrl(fallbackMedia.thumbnail)
    : null
  const shouldShowBlackScreen = shouldApplyFallback && liveControls.blackScreen
  const shouldForceLogoFallback =
    shouldApplyFallback && liveControls.showLogo && !shouldShowBlackScreen
  const shouldShowFallbackBackground =
    shouldApplyFallback &&
    !shouldShowBlackScreen &&
    (shouldForceLogoFallback || !hasLiveItem || keepFallbackDuringThemeEnter)
  const shouldRenderPresentation = !shouldShowBlackScreen && !shouldForceLogoFallback
  const containerBackground = shouldShowFallbackBackground ? fallbackColor : '#000000'

  return (
    <div className="overflow-hidden w-full h-full" style={{ background: containerBackground }}>
      {/* Capa de fondo: logo/fallback */}
      {shouldShowFallbackBackground && fallbackMediaUrl && (
        <div className="absolute inset-0 z-0">
          {fallbackMedia!.type === 'VIDEO' ? (
            <video
              src={fallbackMediaUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={fallbackThumbnailUrl ?? fallbackMediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Contenido de la presentación en vivo (encima del fondo) */}
      {shouldRenderPresentation ? (
        <div className="relative z-10 w-full h-full">
          <PresentationView
            items={content?.content || []}
            theme={selectedTheme}
            currentIndex={itemIndex}
            themeTransitionKey={themeKey}
            presentationVerseBySlideKey={presentationVerseBySlideKey}
            hideTextInLive={liveControls.hideText}
            live
            displayId={displayId && !isPreview ? parseInt(displayId) : undefined}
          />
        </div>
      ) : null}
    </div>
  )
}
