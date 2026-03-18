import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { BASE_PRESENTATION_HEIGHT } from '@/lib/themeConstants'
import {
  EditableBoundsTarget,
  PresentationViewItems,
  ThemeWithMedia,
  TextBoundsValues
} from '../types'
import useBiblePresentationSetting from '../hooks/useBibleSetting'
import useBibleSchema from '@/hooks/useBibleSchema'
import { AnimatedText } from './AnimatedText'
import { canProcessVerseDragMove, hasMeaningfulVerseDrag } from '../utils/verseInteraction'
import { splitHtmlForWordAnimation } from '../utils/splitHtmlForWordAnimation'

interface BibleTextRenderProps {
  item: PresentationViewItems
  animationType: AnimationType
  variants: any
  textStyle: React.CSSProperties
  isPreview?: boolean
  theme: ThemeWithMedia
  smallFontSize: string
  textContainerPadding: {
    horizontal: number
    vertical: number
  }
  textContainerOffset: {
    x: number
    y: number
  }
  verticalAlign?: 'top' | 'center' | 'bottom'
  scaleFactor: number
  presentationHeight: number
  showTextBounds?: boolean
  textBoundsIsSelected?: boolean
  bibleVerseIsSelected?: boolean
  textBoundsBaseValues?: TextBoundsValues
  textBoundsScale?: {
    x: number
    y: number
  }
  onTextBoundsChange?: (next: TextBoundsValues) => void
  onBibleVersePositionChange?: (next: number) => void
  onEditableTargetSelect?: (target: EditableBoundsTarget) => void
  hideTextInLive?: boolean
  blockBgStyle?: React.CSSProperties | null
  blockBgPadding?: number | null
  animationDuration?: number
}

type ActiveVerseInteraction = {
  startY: number
  startValue: number
  position: 'upScreen' | 'downScreen'
  isDragging: boolean
}

const MAX_BIBLE_EDGE_OFFSET_BASE = 72

const toFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const buildVerseInlineStyle = (style: React.CSSProperties) =>
  Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
      const cssValue = typeof value === 'number' ? String(value) : String(value)
      return `${cssKey}: ${cssValue}`
    })
    .join('; ')

export function BibleTextRender({
  item,
  animationType,
  variants,
  textStyle,
  isPreview,
  theme,
  smallFontSize,
  textContainerPadding,
  textContainerOffset,
  verticalAlign = 'center',
  scaleFactor,
  presentationHeight,
  showTextBounds = false,
  textBoundsIsSelected = true,
  bibleVerseIsSelected = false,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  onBibleVersePositionChange,
  onEditableTargetSelect,
  hideTextInLive = false,
  blockBgStyle,
  blockBgPadding,
  animationDuration
}: BibleTextRenderProps) {
  const activeVerseInteractionRef = useRef<ActiveVerseInteraction | null>(null)
  const [verseCursor, setVerseCursor] = useState<React.CSSProperties['cursor']>('move')
  const { text: rawText, verse } = item
  const { biblePresentationSettings } = useBiblePresentationSetting()
  const { getCompleteNameById, getShortNameById } = useBibleSchema()

  const selectedBiblePresentationSettings = useMemo(
    () =>
      theme.useDefaultBibleSettings ? biblePresentationSettings : theme.biblePresentationSettings!,
    [theme.useDefaultBibleSettings, theme.biblePresentationSettings, biblePresentationSettings]
  )

  const isScreenModeVerse = useMemo(
    () =>
      verse &&
      (selectedBiblePresentationSettings?.position === 'upScreen' ||
        selectedBiblePresentationSettings?.position === 'downScreen'),
    [verse, selectedBiblePresentationSettings?.position]
  )

  const positionIsScreenMode =
    selectedBiblePresentationSettings?.position === 'upScreen' ||
    selectedBiblePresentationSettings?.position === 'downScreen'

  const rawVersePositionStyle = Number(selectedBiblePresentationSettings?.positionStyle || 0)
  const clampedVersePositionStyle = Math.min(
    Math.max(0, rawVersePositionStyle),
    MAX_BIBLE_EDGE_OFFSET_BASE
  )

  const shouldShowVerseBounds = showTextBounds && bibleVerseIsSelected && isScreenModeVerse
  const canEditVerseBounds =
    showTextBounds &&
    onBibleVersePositionChange !== undefined &&
    positionIsScreenMode &&
    scaleFactor > 0

  const handleVersePointerMove = useCallback(
    (event: PointerEvent) => {
      const activeVerse = activeVerseInteractionRef.current
      if (!activeVerse || !scaleFactor || !onBibleVersePositionChange) return

      if (!canProcessVerseDragMove(event.buttons)) {
        return
      }

      const deltaYBase = (event.clientY - activeVerse.startY) / scaleFactor

      if (!activeVerse.isDragging && !hasMeaningfulVerseDrag(deltaYBase)) {
        return
      }

      activeVerse.isDragging = true

      const nextValueRaw =
        activeVerse.position === 'upScreen'
          ? activeVerse.startValue + deltaYBase
          : activeVerse.startValue - deltaYBase

      const nextValue = Math.round(Math.min(Math.max(0, nextValueRaw), MAX_BIBLE_EDGE_OFFSET_BASE))

      onBibleVersePositionChange(nextValue)
    },
    [onBibleVersePositionChange, scaleFactor]
  )

  const stopVerseInteraction = useCallback(() => {
    activeVerseInteractionRef.current = null
    setVerseCursor('move')
    document.body.style.cursor = ''
    window.removeEventListener('pointermove', handleVersePointerMove)
    window.removeEventListener('pointerup', stopVerseInteraction)
  }, [handleVersePointerMove])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handleVersePointerMove)
      window.removeEventListener('pointerup', stopVerseInteraction)
    }
  }, [handleVersePointerMove, stopVerseInteraction])

  const startVerseInteraction = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if (!canEditVerseBounds) return
      event.preventDefault()
      event.stopPropagation()

      const currentPosition = selectedBiblePresentationSettings?.position
      if (currentPosition !== 'upScreen' && currentPosition !== 'downScreen') return

      activeVerseInteractionRef.current = {
        startY: event.clientY,
        startValue: clampedVersePositionStyle,
        position: currentPosition,
        isDragging: false
      }

      setVerseCursor('ns-resize')
      document.body.style.cursor = 'ns-resize'
      window.addEventListener('pointermove', handleVersePointerMove)
      window.addEventListener('pointerup', stopVerseInteraction)
    },
    [
      canEditVerseBounds,
      clampedVersePositionStyle,
      handleVersePointerMove,
      selectedBiblePresentationSettings?.position,
      stopVerseInteraction
    ]
  )

  const verseText = useMemo(() => {
    if (!verse || !selectedBiblePresentationSettings) return ''
    const { showVersion, description } = selectedBiblePresentationSettings

    const bookName =
      description === 'complete'
        ? getCompleteNameById(verse.bookId)
        : getShortNameById(verse.bookId)

    const versionText = showVersion ? ` (${verse.version})` : ''

    // Fallback defensivo: evitar mostrar "null" mientras el schema carga o si el id no coincide.
    const verseRef = `${verse.chapter}:${verse.verse}`
    if (!bookName) {
      return `${verseRef}${versionText}`
    }

    return `${bookName} ${verseRef}${versionText}`
  }, [verse, selectedBiblePresentationSettings, getCompleteNameById, getShortNameById])

  const safePresentationHeight =
    Number.isFinite(presentationHeight) && presentationHeight > 0
      ? presentationHeight
      : BASE_PRESENTATION_HEIGHT

  const verseOverrideStyle = useMemo(() => {
    const themeTextStyle = (theme.textStyle || {}) as Record<string, unknown>

    const verseBaseFontSize = toFiniteNumber(themeTextStyle.verseFontSize)
    const verseFontSize =
      verseBaseFontSize !== null
        ? `${(safePresentationHeight * verseBaseFontSize) / BASE_PRESENTATION_HEIGHT}px`
        : smallFontSize

    const verseShadowEnabled =
      (themeTextStyle.verseTextShadowEnabled as boolean | undefined) ??
      (themeTextStyle.textShadowEnabled as boolean | undefined)
    const verseShadowColor =
      (themeTextStyle.verseTextShadowColor as string | undefined) ||
      (themeTextStyle.textShadowColor as string | undefined) ||
      'rgba(0,0,0,0.5)'
    const verseShadowBlur =
      toFiniteNumber(themeTextStyle.verseTextShadowBlur) ??
      toFiniteNumber(themeTextStyle.textShadowBlur) ??
      4
    const verseShadowOffsetX =
      toFiniteNumber(themeTextStyle.verseTextShadowOffsetX) ??
      toFiniteNumber(themeTextStyle.textShadowOffsetX) ??
      2
    const verseShadowOffsetY =
      toFiniteNumber(themeTextStyle.verseTextShadowOffsetY) ??
      toFiniteNumber(themeTextStyle.textShadowOffsetY) ??
      2

    const verseStrokeEnabled =
      (themeTextStyle.verseTextStrokeEnabled as boolean | undefined) ??
      (themeTextStyle.textStrokeEnabled as boolean | undefined)
    const verseStrokeColor =
      (themeTextStyle.verseTextStrokeColor as string | undefined) ||
      (themeTextStyle.textStrokeColor as string | undefined) ||
      '#000000'
    const verseStrokeWidth =
      toFiniteNumber(themeTextStyle.verseTextStrokeWidth) ??
      toFiniteNumber(themeTextStyle.textStrokeWidth) ??
      1

    return {
      fontFamily:
        (themeTextStyle.verseFontFamily as string | undefined) ||
        (textStyle.fontFamily as string | undefined),
      fontSize: verseFontSize,
      color:
        (themeTextStyle.verseColor as string | undefined) ||
        (textStyle.color as string | undefined),
      fontWeight:
        (themeTextStyle.verseFontWeight as React.CSSProperties['fontWeight']) ||
        textStyle.fontWeight,
      fontStyle:
        (themeTextStyle.verseFontStyle as React.CSSProperties['fontStyle']) || textStyle.fontStyle,
      textDecoration:
        (themeTextStyle.verseTextDecoration as React.CSSProperties['textDecoration']) ||
        textStyle.textDecoration,
      lineHeight:
        toFiniteNumber(themeTextStyle.verseLineHeight) ??
        toFiniteNumber(textStyle.lineHeight) ??
        undefined,
      letterSpacing:
        toFiniteNumber(themeTextStyle.verseLetterSpacing) ??
        toFiniteNumber(textStyle.letterSpacing) ??
        undefined,
      textAlign:
        (themeTextStyle.verseTextAlign as React.CSSProperties['textAlign']) || textStyle.textAlign,
      ...(verseShadowEnabled
        ? {
            textShadow: `${(verseShadowOffsetX * scaleFactor).toFixed(1)}px ${(verseShadowOffsetY * scaleFactor).toFixed(1)}px ${(verseShadowBlur * scaleFactor).toFixed(1)}px ${verseShadowColor}`
          }
        : {}),
      ...(verseStrokeEnabled
        ? { WebkitTextStroke: `${(verseStrokeWidth * scaleFactor).toFixed(2)}px ${verseStrokeColor}` }
        : {})
    } as React.CSSProperties
  }, [safePresentationHeight, smallFontSize, theme.textStyle, textStyle, scaleFactor])

  const verseInlineStyle = useMemo(() => buildVerseInlineStyle(verseOverrideStyle), [verseOverrideStyle])

  const formattedVerseText = useMemo(() => {
    if (!verseText) return ''
    return `<span style="${verseInlineStyle}">${verseText}</span>`
  }, [verseInlineStyle, verseText])

  const normalizedRawText = useMemo(() => {
    const baseText = rawText || ''
    if (!verse) return baseText
    if (selectedBiblePresentationSettings?.showVerseNumber) return baseText

    const versePrefixRegex = new RegExp(`^\\s*${verse.verse}\\.?\\s+`)
    return baseText.replace(versePrefixRegex, '')
  }, [rawText, verse, selectedBiblePresentationSettings?.showVerseNumber])

  const text = useMemo(() => {
    let finalText = normalizedRawText
    if (verse && selectedBiblePresentationSettings?.showVerseNumber) {
      finalText = `${verse.verse} ${finalText}`
    }

    if (verse && !isScreenModeVerse && selectedBiblePresentationSettings) {
      const position = selectedBiblePresentationSettings.position

      if (position === 'afterText') {
        finalText = `${finalText} ${formattedVerseText}`
      }
      if (position === 'beforeText') {
        finalText = `${formattedVerseText} ${finalText}`
      }
      if (position === 'underText') {
        finalText = `${finalText} <br/> ${formattedVerseText}`
      }
      if (position === 'overText') {
        finalText = `${formattedVerseText} <br/> ${finalText}`
      }
    }

    return finalText
  }, [normalizedRawText, isScreenModeVerse, verse, formattedVerseText, selectedBiblePresentationSettings])

  const verseTextStyle = useMemo(
    () => ({
      ...textStyle,
      ...verseOverrideStyle,
      width: '100%',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign:
        (verseOverrideStyle.textAlign as React.CSSProperties['textAlign']) ||
        ('center' as const)
    }),
    [textStyle, verseOverrideStyle]
  )

  const renderVerseContent = useCallback(
    (textContext: string) => {
      if (isPreview) {
        return (
          <div
            style={verseTextStyle}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }}
          />
        )
      }

      if (animationType === 'split') {
        const lines = splitHtmlForWordAnimation(textContext)

        return (
          <m.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={verseTextStyle}
          >
            {lines.map((words, lineIndex) => {
              return (
                <div key={lineIndex}>
                  {words.map((word, wordIndex) => (
                    <m.span
                      key={`${lineIndex}-${wordIndex}`}
                      variants={wordVariants}
                      style={{ display: 'inline-block', marginRight: '0.3em' }}
                      dangerouslySetInnerHTML={{ __html: word }}
                    />
                  ))}
                  {lineIndex < lines.length - 1 && <br />}
                </div>
              )
            })}
          </m.div>
        )
      }

      return (
        <m.div
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={verseTextStyle}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(textContext) }}
        />
      )
    },
    [animationType, variants, verseTextStyle, isPreview]
  )

  const verseEdgeOffsetPx = `${(safePresentationHeight * clampedVersePositionStyle) / BASE_PRESENTATION_HEIGHT}px`

  const handleSelectTarget = useCallback(() => {
    onEditableTargetSelect?.('verse')
  }, [onEditableTargetSelect])

  return (
    <>
      <AnimatedText
        item={{ ...item, text }}
        animationType={animationType}
        variants={variants}
        textStyle={textStyle}
        isPreview={isPreview}
        textContainerPadding={textContainerPadding}
        textContainerOffset={textContainerOffset}
        verticalAlign={verticalAlign}
        showTextBounds={showTextBounds}
        textBoundsIsSelected={textBoundsIsSelected}
        textBoundsBaseValues={textBoundsBaseValues}
        textBoundsScale={textBoundsScale}
        onTextBoundsChange={onTextBoundsChange}
        onEditableTargetSelect={onEditableTargetSelect}
        hideTextInLive={hideTextInLive}
        blockBgStyle={blockBgStyle}
        blockBgPadding={blockBgPadding}
        animationDuration={animationDuration}
      />

      {isScreenModeVerse && verseText && !(hideTextInLive && !isPreview) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            fontSize: smallFontSize,
            cursor: canEditVerseBounds ? verseCursor : 'default',
            border: shouldShowVerseBounds ? '2px dashed rgba(255,255,255,0.65)' : 'none',
            borderRadius: shouldShowVerseBounds ? 8 : 0,
            padding: shouldShowVerseBounds ? '2px 6px' : '0 12px',
            boxSizing: 'border-box',
            touchAction: canEditVerseBounds ? 'none' : 'auto',
            pointerEvents: 'auto',
            zIndex: shouldShowVerseBounds ? 2 : 1,
            bottom:
              selectedBiblePresentationSettings?.position === 'downScreen'
                ? verseEdgeOffsetPx
                : 'auto',
            top:
              selectedBiblePresentationSettings?.position === 'upScreen'
                ? verseEdgeOffsetPx
                : 'auto'
          }}
          onPointerDown={(event) => {
            if (showTextBounds) {
              handleSelectTarget()
            }

            if (!canEditVerseBounds) {
              return
            }

            startVerseInteraction(event)
          }}
          onPointerMove={() => {
            if (canEditVerseBounds && !activeVerseInteractionRef.current) {
              setVerseCursor('ns-resize')
            }
          }}
          onPointerLeave={() => {
            if (!activeVerseInteractionRef.current) {
              setVerseCursor('move')
            }
          }}
        >
          {renderVerseContent(formattedVerseText)}
        </div>
      )}
    </>
  )
}
