import { useMemo, useRef } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { BASE_PRESENTATION_HEIGHT } from '@/lib/themeConstants'
import { EditableBoundsTarget, SongMeta, ThemeWithMedia } from '../types'
import { splitHtmlForWordAnimation } from '../utils/splitHtmlForWordAnimation'

interface CopyrightTextRenderProps {
  songMeta: SongMeta
  theme: ThemeWithMedia
  textStyle: React.CSSProperties
  isPreview?: boolean
  animationType: AnimationType
  variants: any
  hideTextInLive?: boolean
  scaleFactor: number
  presentationHeight: number
  showCopyright?: boolean
  copyrightBoundsIsSelected?: boolean
  onCopyrightPositionChange?: (next: { translateX: number; translateY: number }) => void
  onEditableTargetSelect?: (target: EditableBoundsTarget) => void
}

const COPYRIGHT_EDGE_OFFSET_BASE = 16

const toFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function CopyrightTextRender({
  songMeta,
  theme,
  textStyle,
  isPreview = false,
  animationType,
  variants,
  hideTextInLive = false,
  scaleFactor,
  presentationHeight,
  showCopyright = true,
  copyrightBoundsIsSelected = false,
  onCopyrightPositionChange,
  onEditableTargetSelect
}: CopyrightTextRenderProps) {
  const copyrightText = useMemo(() => {
    const parts: string[] = []
    if (songMeta.copyright) parts.push(`© ${songMeta.copyright}`)
    if (songMeta.author && !songMeta.copyright?.includes(songMeta.author)) {
      if (parts.length > 0) {
        const idx = parts[0].indexOf(songMeta.author)
        if (idx === -1) {
          parts.push(songMeta.author)
        }
      } else {
        parts.push(songMeta.author)
      }
    }
    const line2 = parts.length > 0 ? parts.join(' | ') : ''
    if (songMeta.title && line2) {
      return `${songMeta.title}<br/>${line2}`
    }
    return songMeta.title || line2
  }, [songMeta])

  const safePresentationHeight =
    Number.isFinite(presentationHeight) && presentationHeight > 0
      ? presentationHeight
      : BASE_PRESENTATION_HEIGHT

  const themeTextStyle = (theme.textStyle || {}) as Record<string, unknown>

  const copyrightOverrideStyle = useMemo((): React.CSSProperties => {
    const copyrightBaseFontSize =
      toFiniteNumber(themeTextStyle.copyrightFontSize) ?? 12
    const copyrightFontSize = `${(safePresentationHeight * copyrightBaseFontSize) / BASE_PRESENTATION_HEIGHT}px`

    const copyrightShadowEnabled =
      (themeTextStyle.copyrightTextShadowEnabled as boolean | undefined) ??
      (themeTextStyle.textShadowEnabled as boolean | undefined)
    const copyrightShadowColor =
      (themeTextStyle.copyrightTextShadowColor as string | undefined) ||
      (themeTextStyle.textShadowColor as string | undefined) ||
      'rgba(0,0,0,0.5)'
    const copyrightShadowBlur =
      toFiniteNumber(themeTextStyle.copyrightTextShadowBlur) ??
      toFiniteNumber(themeTextStyle.textShadowBlur) ??
      4
    const copyrightShadowOffsetX =
      toFiniteNumber(themeTextStyle.copyrightTextShadowOffsetX) ??
      toFiniteNumber(themeTextStyle.textShadowOffsetX) ??
      2
    const copyrightShadowOffsetY =
      toFiniteNumber(themeTextStyle.copyrightTextShadowOffsetY) ??
      toFiniteNumber(themeTextStyle.textShadowOffsetY) ??
      2

    const copyrightStrokeEnabled =
      (themeTextStyle.copyrightTextStrokeEnabled as boolean | undefined) ??
      (themeTextStyle.textStrokeEnabled as boolean | undefined)
    const copyrightStrokeColor =
      (themeTextStyle.copyrightTextStrokeColor as string | undefined) ||
      (themeTextStyle.textStrokeColor as string | undefined) ||
      '#000000'
    const copyrightStrokeWidth =
      toFiniteNumber(themeTextStyle.copyrightTextStrokeWidth) ??
      toFiniteNumber(themeTextStyle.textStrokeWidth) ??
      1

    return {
      fontFamily:
        (themeTextStyle.copyrightFontFamily as string | undefined) ||
        (textStyle.fontFamily as string | undefined),
      fontSize: copyrightFontSize,
      color:
        (themeTextStyle.copyrightColor as string | undefined) ||
        (textStyle.color as string | undefined),
      fontWeight:
        (themeTextStyle.copyrightFontWeight as React.CSSProperties['fontWeight']) ||
        textStyle.fontWeight,
      fontStyle:
        (themeTextStyle.copyrightFontStyle as React.CSSProperties['fontStyle']) ||
        textStyle.fontStyle ||
        'italic',
      textDecoration:
        (themeTextStyle.copyrightTextDecoration as React.CSSProperties['textDecoration']) ||
        textStyle.textDecoration,
      lineHeight:
        toFiniteNumber(themeTextStyle.copyrightLineHeight) ??
        toFiniteNumber(textStyle.lineHeight) ??
        undefined,
      letterSpacing:
        toFiniteNumber(themeTextStyle.copyrightLetterSpacing) ??
        toFiniteNumber(textStyle.letterSpacing) ??
        undefined,
      ...(copyrightShadowEnabled
        ? {
            textShadow: `${(copyrightShadowOffsetX * scaleFactor).toFixed(1)}px ${(copyrightShadowOffsetY * scaleFactor).toFixed(1)}px ${(copyrightShadowBlur * scaleFactor).toFixed(1)}px ${copyrightShadowColor}`
          }
        : {}),
      ...(copyrightStrokeEnabled
        ? {
            WebkitTextStroke: `${(copyrightStrokeWidth * scaleFactor).toFixed(2)}px ${copyrightStrokeColor}`
          }
        : {})
    } as React.CSSProperties
  }, [safePresentationHeight, theme.textStyle, textStyle, scaleFactor, themeTextStyle])

  const dragRef = useRef({ startX: 0, startY: 0, startTranslateX: 0, startTranslateY: 0 })
  const isDraggingRef = useRef(false)

  if (!showCopyright || !copyrightText || (hideTextInLive && !isPreview)) {
    return null
  }

  const copyrightEdgeOffsetPx = `${(safePresentationHeight * COPYRIGHT_EDGE_OFFSET_BASE) / BASE_PRESENTATION_HEIGHT}px`

  const copyrightTranslateX = toFiniteNumber(themeTextStyle.copyrightTranslateX) ?? 0
  const copyrightTranslateY = toFiniteNumber(themeTextStyle.copyrightTranslateY) ?? 0
  const copyrightInline = toFiniteNumber(themeTextStyle.copyrightInline) ?? 0
  const copyrightBlock = toFiniteNumber(themeTextStyle.copyrightBlock) ?? 0

  const baseRight = (safePresentationHeight * (COPYRIGHT_EDGE_OFFSET_BASE + copyrightInline)) / BASE_PRESENTATION_HEIGHT
  const baseBottom = (safePresentationHeight * (COPYRIGHT_EDGE_OFFSET_BASE + copyrightBlock)) / BASE_PRESENTATION_HEIGHT
  const scaledTranslateX = (safePresentationHeight * copyrightTranslateX) / BASE_PRESENTATION_HEIGHT
  const scaledTranslateY = (safePresentationHeight * copyrightTranslateY) / BASE_PRESENTATION_HEIGHT

  const posStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${baseRight}px`,
    bottom: `${baseBottom}px`,
    transform: `translate(${scaledTranslateX}px, ${scaledTranslateY}px)`,
    whiteSpace: 'nowrap',
    ...(copyrightBoundsIsSelected
      ? {
          cursor: 'move',
          outline: '2px dashed rgba(255,255,255,0.6)',
          outlineOffset: '4px',
          userSelect: 'none'
        }
      : {}),
    ...copyrightOverrideStyle
  }

  const lines = animationType === 'split' ? splitHtmlForWordAnimation(copyrightText) : null

  const animated = isPreview ? (
    <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(copyrightText) }} />
  ) : animationType === 'split' ? (
    <m.div variants={variants} initial="initial" animate="animate" exit="exit">
      {lines!.map((words, lineIndex) => (
        <div key={lineIndex}>
          {words.map((word, wordIndex) => (
            <m.span key={`${lineIndex}-${wordIndex}`} variants={wordVariants}
              style={{ display: 'inline-block', marginRight: '0.3em' }}
              dangerouslySetInnerHTML={{ __html: word }} />
          ))}
          {lineIndex < lines!.length - 1 && <br />}
        </div>
      ))}
    </m.div>
  ) : (
    <m.div variants={variants} initial="initial" animate="animate" exit="exit" dangerouslySetInnerHTML={{ __html: sanitizeHTML(copyrightText) }} />
  )

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (onEditableTargetSelect && !copyrightBoundsIsSelected) {
          onEditableTargetSelect('copyright')
        }
      }}
      onPointerDown={(e) => {
        if (!onCopyrightPositionChange || !copyrightBoundsIsSelected) return
        e.preventDefault()
        e.stopPropagation()
        const el = e.currentTarget as HTMLElement
        el.setPointerCapture(e.pointerId)
        dragRef.current = {
          startX: e.clientX, startY: e.clientY,
          startTranslateX: copyrightTranslateX, startTranslateY: copyrightTranslateY
        }
        isDraggingRef.current = true
      }}
      onPointerMove={(e) => {
        if (!isDraggingRef.current) return
        const scale = safePresentationHeight / BASE_PRESENTATION_HEIGHT
        const dx = (e.clientX - dragRef.current.startX) / scale
        const dy = (e.clientY - dragRef.current.startY) / scale
        if (Math.abs(dx) < 3 / scale && Math.abs(dy) < 3 / scale) return
        onCopyrightPositionChange({
          translateX: Math.round(dragRef.current.startTranslateX + dx),
          translateY: Math.round(dragRef.current.startTranslateY + dy)
        })
      }}
      onPointerUp={(e) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        const el = e.currentTarget as HTMLElement
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      }}
      style={{ ...posStyle, touchAction: 'none', zIndex: 100 }}
    >
      {animated}
    </div>
  )
}
