import { useCallback, useMemo } from 'react'
import { m } from 'framer-motion'
import { sanitizeHTML } from '@/lib/utils'
import { wordVariants, AnimationType } from '@/lib/animations'
import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import {
  EditableBoundsTarget,
  PresentationViewItems,
  ThemeWithMedia,
  TextBoundsValues
} from '../types'
import useBiblePresentationSetting from '../hooks/useBibleSetting'
import useBibleSchema from '@/hooks/useBibleSchema'
import { AnimatedText } from './AnimatedText'
import { splitHtmlForWordAnimation } from '../utils/splitHtmlForWordAnimation'
import { resolveBibleVerseTranslateX, resolveBibleVerseWidthPercent } from '../utils/verseWidth'
import { useTextBoundsInteraction } from '../hooks/useTextBoundsInteraction'

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
  onBibleVerseWidthChange?: (next: number) => void
  onBibleVerseTranslateXChange?: (next: number) => void
  onBibleVerseHorizontalBoundsChange?: (next: { widthPercent: number; translateX: number }) => void
  onEditableTargetSelect?: (target: EditableBoundsTarget) => void
  hideTextInLive?: boolean
  blockBgStyle?: React.CSSProperties | null
  blockBgPadding?: number | null
  animationDuration?: number
}

const MAX_BIBLE_EDGE_OFFSET_BASE = 72
const SIDE_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  width: 11,
  height: 11,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.75)',
  background: 'rgba(20,184,166,0.9)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
  transform: 'translateY(-50%)',
  zIndex: 3
}

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
  onBibleVerseWidthChange,
  onBibleVerseTranslateXChange,
  onBibleVerseHorizontalBoundsChange,
  onEditableTargetSelect,
  hideTextInLive = false,
  blockBgStyle,
  blockBgPadding,
  animationDuration
}: BibleTextRenderProps) {
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
  const canEditVersePosition =
    showTextBounds &&
    onBibleVersePositionChange !== undefined &&
    positionIsScreenMode &&
    scaleFactor > 0
  const canEditVerseWidth =
    showTextBounds &&
    (onBibleVerseWidthChange !== undefined || onBibleVerseHorizontalBoundsChange !== undefined) &&
    positionIsScreenMode &&
    scaleFactor > 0
  const verseWidthPercent = useMemo(
    () =>
      resolveBibleVerseWidthPercent(
        (theme.textStyle as Record<string, unknown> | undefined)?.verseWidthPercent
      ),
    [theme.textStyle]
  )
  const verseTranslateX = useMemo(
    () =>
      resolveBibleVerseTranslateX(
        (theme.textStyle as Record<string, unknown> | undefined)?.verseTranslateX
      ),
    [theme.textStyle]
  )

  const verseBoundsBaseValues = useMemo<TextBoundsValues | undefined>(() => {
    if (!positionIsScreenMode) return undefined

    const paddingInline = (BASE_PRESENTATION_WIDTH * (100 - verseWidthPercent)) / 200
    const clampedTranslateX = Math.max(-paddingInline, Math.min(paddingInline, verseTranslateX))
    const translateY =
      selectedBiblePresentationSettings?.position === 'upScreen'
        ? clampedVersePositionStyle - MAX_BIBLE_EDGE_OFFSET_BASE
        : MAX_BIBLE_EDGE_OFFSET_BASE - clampedVersePositionStyle

    return {
      paddingInline,
      paddingBlock: MAX_BIBLE_EDGE_OFFSET_BASE,
      translateX: clampedTranslateX,
      translateY
    }
  }, [
    clampedVersePositionStyle,
    positionIsScreenMode,
    selectedBiblePresentationSettings?.position,
    verseTranslateX,
    verseWidthPercent
  ])

  const verseBoundsScale = useMemo(
    () => ({
      x: textBoundsScale?.x ?? scaleFactor,
      y: textBoundsScale?.y ?? scaleFactor
    }),
    [scaleFactor, textBoundsScale?.x, textBoundsScale?.y]
  )

  const handleVerseBoundsChange = useCallback(
    (next: TextBoundsValues) => {
      if (!positionIsScreenMode) return

      const nextWidth = resolveBibleVerseWidthPercent(
        100 - ((next.paddingInline * 2) / BASE_PRESENTATION_WIDTH) * 100
      )
      const nextTranslateX = Math.round(next.translateX)

      if (onBibleVerseHorizontalBoundsChange) {
        onBibleVerseHorizontalBoundsChange({
          widthPercent: nextWidth,
          translateX: nextTranslateX
        })
      } else {
        onBibleVerseWidthChange?.(nextWidth)
        onBibleVerseTranslateXChange?.(nextTranslateX)
      }

      if (onBibleVersePositionChange) {
        const nextPosition =
          selectedBiblePresentationSettings?.position === 'upScreen'
            ? next.paddingBlock + next.translateY
            : next.paddingBlock - next.translateY

        onBibleVersePositionChange(
          Math.round(Math.min(Math.max(0, nextPosition), MAX_BIBLE_EDGE_OFFSET_BASE))
        )
      }
    },
    [
      onBibleVersePositionChange,
      onBibleVerseHorizontalBoundsChange,
      onBibleVerseTranslateXChange,
      onBibleVerseWidthChange,
      positionIsScreenMode,
      selectedBiblePresentationSettings?.position
    ]
  )

  const canEditVerseBounds = Boolean(
    shouldShowVerseBounds &&
      verseBoundsBaseValues !== undefined &&
      (canEditVersePosition || canEditVerseWidth) &&
      verseBoundsScale.x > 0 &&
      verseBoundsScale.y > 0
  )

  const {
    boundsCursor,
    snapGuides,
    onBoundsPointerMove,
    onBoundsPointerLeave,
    onBoundsPointerDown,
    startInteraction
  } =
    useTextBoundsInteraction({
      canEditBounds: canEditVerseBounds,
      textBoundsBaseValues: verseBoundsBaseValues,
      textBoundsScale: verseBoundsScale,
      onTextBoundsChange: handleVerseBoundsChange,
      allowedModes: ['move', 'resize-left', 'resize-right'],
      lockPaddingBlock: true,
      snapAxes: {
        x: true,
        y: false
      }
    })

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
      maxWidth: '100%',
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

  const handleVerseResizeHandlePointerDown = useCallback(
    (mode: 'resize-left' | 'resize-right', event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      startInteraction(mode, event)
    },
    [startInteraction]
  )

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

      {canEditVerseBounds && snapGuides.centerX ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(20,184,166,0.85)',
            transform: 'translateX(-0.5px)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      ) : null}

      {isScreenModeVerse && verseText && !(hideTextInLive && !isPreview) && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            width: `${verseWidthPercent}%`,
            maxWidth: '100%',
            fontSize: smallFontSize,
            cursor: canEditVerseBounds ? boundsCursor : 'default',
            border: shouldShowVerseBounds ? '2px dashed rgba(255,255,255,0.65)' : 'none',
            borderRadius: shouldShowVerseBounds ? 8 : 0,
            padding: shouldShowVerseBounds ? '2px 6px' : '0 12px',
            boxSizing: 'border-box',
            touchAction: canEditVerseBounds ? 'none' : 'auto',
            pointerEvents: 'auto',
            zIndex: shouldShowVerseBounds ? 2 : 1,
            transform: `translateX(calc(-50% + ${(verseBoundsBaseValues?.translateX ?? 0) * verseBoundsScale.x}px))`,
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
            const target = event.target as HTMLElement | null
            if (target?.closest('[data-verse-resize-handle="true"]')) {
              return
            }

            if (showTextBounds) {
              handleSelectTarget()
            }

            if (!canEditVerseBounds) {
              return
            }

            onBoundsPointerDown(event)
          }}
          onPointerMove={(event) => {
            onBoundsPointerMove(event)
          }}
          onPointerLeave={() => {
            onBoundsPointerLeave()
          }}
        >
          {canEditVerseBounds ? (
            <>
              <button
                type="button"
                data-verse-resize-handle="true"
                aria-label="Redimensionar indicador desde la izquierda"
                style={{
                  ...SIDE_HANDLE_STYLE,
                  left: -5.5,
                  cursor: 'ew-resize'
                }}
                onPointerDownCapture={(event) => {
                  event.stopPropagation()
                }}
                onPointerDown={(event) => handleVerseResizeHandlePointerDown('resize-left', event)}
              />
              <button
                type="button"
                data-verse-resize-handle="true"
                aria-label="Redimensionar indicador desde la derecha"
                style={{
                  ...SIDE_HANDLE_STYLE,
                  right: -5.5,
                  cursor: 'ew-resize'
                }}
                onPointerDownCapture={(event) => {
                  event.stopPropagation()
                }}
                onPointerDown={(event) =>
                  handleVerseResizeHandlePointerDown('resize-right', event)
                }
              />
            </>
          ) : null}
          {renderVerseContent(formattedVerseText)}
        </div>
      )}
    </>
  )
}
