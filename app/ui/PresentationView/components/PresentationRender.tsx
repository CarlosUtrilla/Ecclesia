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
import { getPresentationSlideKey, resolveSlideVerse } from '@/lib/presentationVerseController'
import { sanitizeHTML } from '@/lib/utils'

type Props = React.ComponentProps<typeof AnimatedText> & {
  presentationVerseBySlideKey?: Record<string, number>
  currentIndex?: number
  theme?: React.ComponentProps<typeof BibleTextRender>['theme']
  smallFontSize?: string
  scaleFactor?: number
  presentationHeight?: number
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

      const cssProperty = property.startsWith('--')
        ? property
        : property.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      ;(acc as Record<string, string>)[cssProperty] = value
      return acc
    }, {})
}

const renderShapeLayer = (item: PresentationLayerItem, style: CSSProperties) => {
  const fill = String(
    (style as Record<string, unknown>)['--shape-fill'] || 'rgba(59, 130, 246, 0.18)'
  )
  const stroke = String((style as Record<string, unknown>)['--shape-stroke'] || '#2563eb')
  const strokeWidth = Number((style as Record<string, unknown>)['--shape-stroke-width'] || 4)
  const opacity = Number((style as Record<string, unknown>)['--shape-opacity'] || 1)
  const resolvedShapeType = item.shapeType || 'rectangle'

  if (resolvedShapeType === 'arrow') {
    return (
      <div className="w-full h-full pointer-events-none" style={{ opacity }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <polygon
            points="0,35 68,35 68,12 100,50 68,88 68,65 0,65"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  if (resolvedShapeType === 'line-arrow') {
    return (
      <div className="w-full h-full pointer-events-none" style={{ opacity }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <line
            x1="8"
            y1="50"
            x2="82"
            y2="50"
            stroke={stroke}
            strokeWidth={strokeWidth * 2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points="68,32 92,50 68,68"
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    )
  }

  if (resolvedShapeType === 'triangle') {
    return (
      <div className="w-full h-full pointer-events-none" style={{ opacity }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <polygon
            points="50,6 96,94 4,94"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  if (resolvedShapeType === 'line') {
    return (
      <div className="w-full h-full pointer-events-none" style={{ opacity }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <line
            x1="8"
            y1="50"
            x2="92"
            y2="50"
            stroke={stroke}
            strokeWidth={strokeWidth * 2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    )
  }

  if (resolvedShapeType === 'cross') {
    return (
      <div className="w-full h-full pointer-events-none" style={{ opacity }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <line
            x1="15"
            y1="15"
            x2="85"
            y2="85"
            stroke={stroke}
            strokeWidth={strokeWidth * 1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="85"
            y1="15"
            x2="15"
            y2="85"
            stroke={stroke}
            strokeWidth={strokeWidth * 1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="w-full h-full pointer-events-none" style={{ opacity }}>
      <div
        className="w-full h-full"
        style={{
          backgroundColor: fill,
          border: `${strokeWidth}px solid ${stroke}`,
          borderRadius: resolvedShapeType === 'circle' ? '9999px' : '24px'
        }}
      />
    </div>
  )
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

function LiveSyncedLayerVideo({ src, shouldLoop }: { src: string; shouldLoop: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !window.liveMediaAPI?.onMediaState) return

    const shouldSyncTimeOnPlay = (requestedTime: number) => {
      if (requestedTime === 0 && video.currentTime > 0.08) {
        return false
      }

      return Math.abs(video.currentTime - requestedTime) > 0.25
    }

    const tryPlay = (time: number) => {
      if (shouldSyncTimeOnPlay(time)) {
        video.currentTime = time
      }
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
      loop={shouldLoop}
      muted
      playsInline
      preload="metadata"
    />
  )
}

function PresentationLayer({
  item,
  activeVerse,
  activeChunkStep,
  theme,
  smallFontSize,
  scaleFactor = 1,
  presentationHeight = BASE_PRESENTATION_HEIGHT,
  baseTextStyle,
  baseVerticalAlign,
  textBoundsScale,
  isPreview = false,
  hideTextInLive = false
}: {
  item: PresentationLayerItem
  activeVerse?: number
  activeChunkStep?: number
  theme?: React.ComponentProps<typeof BibleTextRender>['theme']
  smallFontSize?: string
  scaleFactor?: number
  presentationHeight?: number
  baseTextStyle: CSSProperties
  baseVerticalAlign?: 'top' | 'center' | 'bottom'
  textBoundsScale?: {
    x: number
    y: number
  }
  isPreview?: boolean
  hideTextInLive?: boolean
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
            <LiveSyncedLayerVideo src={mediaUrl} shouldLoop={item.videoLoop === true} />
          ) : (
            <img src={mediaUrl} alt={item.media.name} className="w-full h-full object-contain" />
          )}
        </div>
      </m.div>
    )
  }

  if (item.resourceType === 'SHAPE') {
    return (
      <m.div initial="initial" animate="animate" exit="exit" variants={variants} style={style}>
        <div className="relative w-full h-full">
          {renderShapeLayer(item, style)}
          {item.text && !(hideTextInLive && !isPreview) ? (
            <div
              className="absolute inset-0 flex items-center justify-center px-4 text-center break-words overflow-hidden pointer-events-none"
              style={textOnlyStyle}
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.text) }}
            />
          ) : null}
        </div>
      </m.div>
    )
  }

  if (item.resourceType === 'BIBLE' && item.verse && theme) {
    if (hideTextInLive && !isPreview) {
      return null
    }

    const chunkIndex = activeChunkStep ? activeChunkStep - 1 : 0
    const chunkText = Array.isArray(item.chunkParts) ? item.chunkParts[chunkIndex] : undefined
    const resolvedVerse = activeVerse ?? item.verse.verse
    const resolvedText = chunkText ?? getBibleVerseText(item.text, resolvedVerse) ?? item.text ?? ''

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
          scaleFactor={scaleFactor}
          presentationHeight={presentationHeight}
          constrainScreenVerseToSingleLine="auto"
          autoSplitVerseText
          forceHideVerseNumberPrefix={(activeChunkStep ?? 1) > 1}
          showTextBounds={false}
          hideTextInLive={hideTextInLive}
        />
      </div>
    )
  }

  if (hideTextInLive && !isPreview) {
    return null
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
        hideTextInLive={hideTextInLive}
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
    smallFontSize,
    scaleFactor = 1,
    presentationHeight = BASE_PRESENTATION_HEIGHT
  } = props

  const slideStepController = resolveSlideVerse(item, currentIndex, presentationVerseBySlideKey)

  const getLegacyResolvedVerse = () => {
    if (!item.verse) return undefined

    const start = item.verse.verse
    const end = item.verse.verseEnd

    if (end === undefined || end <= start) {
      return start
    }

    const slideKey = getPresentationSlideKey(item, currentIndex)
    const active = presentationVerseBySlideKey?.[slideKey]

    if (active === undefined) {
      return start
    }

    return Math.max(start, Math.min(end, active))
  }

  if (!item.presentationItems || item.presentationItems.length === 0) {
    if (item.verse && theme) {
      const resolvedVerse = getLegacyResolvedVerse() ?? item.verse.verse
      const chunkIndex =
        slideStepController?.mode === 'chunk' ? (slideStepController.current ?? 1) - 1 : 0
      const chunkText = Array.isArray(item.chunkParts) ? item.chunkParts[chunkIndex] : undefined
      const resolvedText =
        chunkText ?? getBibleVerseText(item.text, resolvedVerse) ?? item.text ?? ''

      return (
        <BibleTextRender
          item={{
            ...item,
            text: resolvedText,
            verse: {
              ...item.verse,
              verse: resolvedVerse
            }
          }}
          animationType={props.animationType}
          variants={props.variants}
          textStyle={textStyle}
          isPreview={isPreview}
          theme={theme}
          smallFontSize={smallFontSize || '18px'}
          textContainerPadding={props.textContainerPadding}
          textContainerOffset={props.textContainerOffset}
          verticalAlign={verticalAlign}
          scaleFactor={scaleFactor}
          presentationHeight={presentationHeight}
          showTextBounds={false}
          hideTextInLive={props.hideTextInLive}
          constrainScreenVerseToSingleLine="auto"
          autoSplitVerseText
          forceHideVerseNumberPrefix={
            slideStepController?.mode === 'chunk' && (slideStepController.current ?? 1) > 1
          }
        />
      )
    }

    return <AnimatedText {...props} />
  }

  return (
    <>
      {item.presentationItems.map((layerItem) => (
        <PresentationLayer
          key={layerItem.id}
          item={layerItem}
          activeVerse={
            layerItem.resourceType === 'BIBLE' &&
            slideStepController?.mode === 'verse' &&
            layerItem.verse?.verseEnd
              ? slideStepController?.current
              : undefined
          }
          activeChunkStep={
            layerItem.resourceType === 'BIBLE' &&
            slideStepController?.mode === 'chunk' &&
            slideStepController?.layerId === layerItem.id
              ? slideStepController.current
              : undefined
          }
          theme={theme}
          smallFontSize={smallFontSize}
          scaleFactor={scaleFactor}
          presentationHeight={presentationHeight}
          isPreview={isPreview}
          baseTextStyle={textStyle}
          baseVerticalAlign={verticalAlign}
          textBoundsScale={textBoundsScale}
          hideTextInLive={props.hideTextInLive}
        />
      ))}
    </>
  )
}
