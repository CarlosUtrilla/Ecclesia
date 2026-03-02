import { CSSProperties, useMemo } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { PresentationLayerItem } from '../types'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { AnimatedText } from './AnimatedText'

type Props = React.ComponentProps<typeof AnimatedText>

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

function PresentationLayer({ item }: { item: PresentationLayerItem }) {
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

  if (item.resourceType === 'MEDIA' && item.media) {
    const mediaUrl = buildMediaUrl(item.media.filePath)

    return (
      <m.div initial="initial" animate="animate" exit="exit" variants={variants} style={style}>
        <div className="w-full h-full flex items-center justify-center">
          {item.media.type === 'VIDEO' ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-contain"
              muted
              preload="metadata"
            />
          ) : (
            <img src={mediaUrl} alt={item.media.name} className="w-full h-full object-contain" />
          )}
        </div>
      </m.div>
    )
  }

  return (
    <m.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      style={style}
      className="pointer-events-none"
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.text || '') }} />
    </m.div>
  )
}

export default function PresentationRender(props: Props) {
  const { item } = props

  if (!item.presentationItems || item.presentationItems.length === 0) {
    return <AnimatedText {...props} />
  }

  return (
    <>
      {item.presentationItems.map((layerItem) => (
        <PresentationLayer key={layerItem.id} item={layerItem} />
      ))}
    </>
  )
}
