import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react'
import { m } from 'framer-motion'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import { PresentationLayerItem } from '../types'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { AnimatedText } from './AnimatedText'
import { BibleTextRender } from './BibleTextRender'
import { getBibleVerseText } from '@/lib/bibleVerseSteps'
import { resolveSlideVerse } from '@/lib/presentationVerseController'

type Props = React.ComponentProps<typeof AnimatedText> & {
  presentationVerseBySlideKey?: Record<string, number>
  currentIndex?: number
  theme?: React.ComponentProps<typeof BibleTextRender>['theme']
  smallFontSize?: string
}

const PRESENTATION_LAYER_BASE_WIDTH = 1280
const PRESENTATION_LAYER_BASE_HEIGHT = 720

const LAYER_CONTAINER_STYLE_KEYS = new Set([
  'left',
  'top',
  'width',
  'height',
  'zIndex',
  'position',
  'inset',
  'transform',
  'display',
  'alignItems',
  'justifyContent'
])

const TYPOGRAPHY_SCALE_Y_KEYS = ['fontSize', 'lineHeight'] as const
const TYPOGRAPHY_SCALE_X_KEYS = ['letterSpacing', 'wordSpacing'] as const

const scalePxValue = (value: unknown, scale: number) => {
  if (typeof value === 'number') return value * scale

  if (typeof value !== 'string') return value

  return value.replace(/(-?\d*\.?\d+)px/g, (_, rawValue) => {
    const parsedValue = Number.parseFloat(rawValue)
    if (!Number.isFinite(parsedValue)) return `${rawValue}px`
    return `${parsedValue * scale}px`
  })
}

const parseInlineStyle = (styleText?: string): CSSProperties => {
  if (!styleText) return {}

  return styleText
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<CSSProperties>((acc, declaration) => {
      const [rawProperty, ...valueParts] = declaration.split(':')
      const property = rawProperty?.trim()
      const value = valueParts.join(':').trim()
      if (!property || !value) return acc

      const cssProperty = property.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      ;(acc as Record<string, string>)[cssProperty] = value
      return acc
    }, {})
}

const parseAnimationSettings = (animationSettings?: string): AnimationSettings => {
  if (!animationSettings) return defaultAnimationSettings

  try {
    return {
      ...defaultAnimationSettings,
      ...JSON.parse(animationSettings)
    }
  } catch {
    return defaultAnimationSettings
  }
}

function LiveSyncedLayerVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !window.liveMediaAPI?.onMediaState) return

    const tryPlay = (time: number) => {
      video.currentTime = time
      video.play().catch(() => {
        // noop: puede fallar temporalmente por foco/autoplay policy
      })
    }

    const unsubscribe = window.liveMediaAPI.onMediaState((state) => {
      if (state.action === 'play') {
        tryPlay(state.time)
        return
      }

      if (state.action === 'pause') {
        video.currentTime = state.time
        video.pause()
        return
      }

      if (state.action === 'seek') {
        video.currentTime = state.time
        return
      }

      if (state.action === 'restart') {
        tryPlay(0)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      className="w-full h-full object-contain"
      muted
      preload="metadata"
    />
  )
}

function PresentationLayer({
  item,
  activeVerse,
  theme,
  smallFontSize,
  baseTextStyle,
  baseVerticalAlign,
  textBoundsScale,
  isPreview = false
}: {
  item: PresentationLayerItem
  activeVerse?: number
  theme?: React.ComponentProps<typeof BibleTextRender>['theme']
  smallFontSize?: string
  baseTextStyle: CSSProperties
  baseVerticalAlign?: 'top' | 'center' | 'bottom'
  textBoundsScale?: {
    x: number
    y: number
  }
  isPreview?: boolean
}) {
  const { buildMediaUrl } = useMediaServer()

  const style = useMemo(
    () => ({
      position: 'absolute',
      inset: 0,
      zIndex: Number(item.layer || 0),
      ...parseInlineStyle(item.customStyle)
    }),
    [item.customStyle, item.layer]
  ) as CSSProperties

  const animationSettings = parseAnimationSettings(item.animationSettings)
  const animationType = (animationSettings.type || 'fade') as AnimationType
  const variants = getAnimationVariants(
    animationType,
    animationSettings.duration,
    animationSettings.delay,
    animationSettings.easing
  )

  const layerVerticalAlign =
    style.alignItems === 'flex-start'
      ? 'top'
      : style.alignItems === 'flex-end'
        ? 'bottom'
        : baseVerticalAlign || 'center'

  const textOnlyStyle = useMemo(() => {
    const layerTextStyle = { ...style } as Record<string, unknown>

    for (const key of LAYER_CONTAINER_STYLE_KEYS) {
      delete layerTextStyle[key]
    }

    const rawScaleY = textBoundsScale?.y ?? 1
    const rawScaleX = textBoundsScale?.x ?? 1

    const scaleY = (rawScaleY * BASE_PRESENTATION_HEIGHT) / PRESENTATION_LAYER_BASE_HEIGHT
    const scaleX = (rawScaleX * BASE_PRESENTATION_WIDTH) / PRESENTATION_LAYER_BASE_WIDTH

    for (const key of TYPOGRAPHY_SCALE_Y_KEYS) {
      if (layerTextStyle[key] !== undefined) {
        layerTextStyle[key] = scalePxValue(layerTextStyle[key], scaleY)
      }
    }

    for (const key of TYPOGRAPHY_SCALE_X_KEYS) {
      if (layerTextStyle[key] !== undefined) {
        layerTextStyle[key] = scalePxValue(layerTextStyle[key], scaleX)
      }
    }

    return {
      ...baseTextStyle,
      ...layerTextStyle
    } as CSSProperties
  }, [baseTextStyle, style, textBoundsScale?.x, textBoundsScale?.y])

  if (item.resourceType === 'MEDIA' && item.media) {
    const mediaUrl = buildMediaUrl(item.media.filePath)
    const mediaThumbnailUrl = item.media.thumbnail ? buildMediaUrl(item.media.thumbnail) : null

    if (isPreview) {
      return (
        <div style={style}>
          <div className="w-full h-full flex items-center justify-center">
            {item.media.type === 'VIDEO' ? (
              mediaThumbnailUrl ? (
                <img
                  src={mediaThumbnailUrl}
                  alt={item.media.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-black" />
              )
            ) : (
              <img src={mediaUrl} alt={item.media.name} className="w-full h-full object-contain" />
            )}
          </div>
        </div>
      )
    }

    return (
      <m.div initial="initial" animate="animate" exit="exit" variants={variants} style={style}>
        <div className="w-full h-full flex items-center justify-center">
          {item.media.type === 'VIDEO' ? (
            <LiveSyncedLayerVideo src={mediaUrl} />
          ) : (
            <img src={mediaUrl} alt={item.media.name} className="w-full h-full object-contain" />
          )}
        </div>
      </m.div>
    )
  }

  if (item.resourceType === 'BIBLE' && item.verse && theme) {
    const resolvedVerse = activeVerse ?? item.verse.verse
    const resolvedText = getBibleVerseText(item.text, resolvedVerse) ?? item.text ?? ''

    return (
      <div style={style} className="pointer-events-none">
        <BibleTextRender
          key={`${item.id}-${resolvedVerse}`}
          item={{
            id: item.id,
            text: resolvedText,
            verse: {
              ...item.verse,
              verse: resolvedVerse
            },
            resourceType: item.resourceType
          }}
          animationType={animationType}
          variants={variants}
          textStyle={textOnlyStyle}
          isPreview={isPreview}
          theme={theme}
          smallFontSize={smallFontSize || '18px'}
          textContainerPadding={{ horizontal: 0, vertical: 0 }}
          textContainerOffset={{ x: 0, y: 0 }}
          verticalAlign={layerVerticalAlign}
          scaleFactor={1}
          presentationHeight={BASE_PRESENTATION_HEIGHT}
          showTextBounds={false}
        />
      </div>
    )
  }

  return (
    <div style={style} className="pointer-events-none">
      <AnimatedText
        key={`${item.id}-${activeVerse ?? item.verse?.verse ?? 'base'}`}
        item={{
          id: item.id,
          text:
            item.resourceType === 'BIBLE' && item.verse
              ? (getBibleVerseText(item.text, activeVerse ?? item.verse.verse) ?? item.text ?? '')
              : item.text || '',
          verse:
            item.resourceType === 'BIBLE' && item.verse
              ? {
                  ...item.verse,
                  verse: activeVerse ?? item.verse.verse
                }
              : item.verse,
          resourceType: item.resourceType
        }}
        animationType={animationType}
        variants={variants}
        textStyle={textOnlyStyle}
        isPreview={isPreview}
        textContainerPadding={{ horizontal: 0, vertical: 0 }}
        textContainerOffset={{ x: 0, y: 0 }}
        verticalAlign={layerVerticalAlign}
        showTextBounds={false}
      />
    </div>
  )
}

export default function PresentationRender(props: Props) {
  const {
    item,
    isPreview = false,
    textStyle,
    verticalAlign,
    textBoundsScale,
    presentationVerseBySlideKey,
    currentIndex = 0,
    theme,
    smallFontSize
  } = props

  if (!item.presentationItems || item.presentationItems.length === 0) {
    return <AnimatedText {...props} />
  }

  const slideVerseController = resolveSlideVerse(item, currentIndex, presentationVerseBySlideKey)

  return (
    <>
      {item.presentationItems.map((layerItem) => (
        <PresentationLayer
          key={layerItem.id}
          item={layerItem}
          activeVerse={
            layerItem.resourceType === 'BIBLE' && layerItem.verse?.verseEnd
              ? slideVerseController?.current
              : undefined
          }
          theme={theme}
          smallFontSize={smallFontSize}
          isPreview={isPreview}
          baseTextStyle={textStyle}
          baseVerticalAlign={verticalAlign}
          textBoundsScale={textBoundsScale}
        />
      ))}
    </>
  )
}
