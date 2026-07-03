import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import { BASE_CANVAS_HEIGHT, BASE_CANVAS_WIDTH, CanvasItemStyle } from './slideUtils'

export type BiblePresentationSettingsInput = {
  position?:
    | 'beforeText'
    | 'afterText'
    | 'underText'
    | 'overText'
    | 'upScreen'
    | 'downScreen'
    | string
    | null
  positionStyle?: number | null
}

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export const removeUndefinedFields = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>

const MAX_BIBLE_EDGE_OFFSET_BASE = 72
const DEFAULT_BIBLE_VERSE_WIDTH_PERCENT = 100
const MIN_BIBLE_VERSE_WIDTH_PERCENT = 20

const parseTranslate = (value: unknown) => {
  if (typeof value !== 'string') {
    return { x: 0, y: 0 }
  }

  const parts = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)

  const x = Number.parseFloat(parts[0] || '0')
  const y = Number.parseFloat(parts[1] || '0')

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  }
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const resolveBibleVerseWidthPercent = (value: unknown) => {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return DEFAULT_BIBLE_VERSE_WIDTH_PERCENT
  return Math.min(
    Math.max(MIN_BIBLE_VERSE_WIDTH_PERCENT, Math.round(parsed)),
    DEFAULT_BIBLE_VERSE_WIDTH_PERCENT
  )
}

const resolveBibleVerseTranslateX = (value: unknown) => {
  const parsed = toFiniteNumber(value)
  return parsed === null ? 0 : Math.round(parsed)
}

const measureVerseLineHeightInCanvas = (
  themeTextStyle: Record<string, unknown>,
  scaleY: number
) => {
  const verseFontBase =
    toFiniteNumber(themeTextStyle.verseFontSize) ??
    (() => {
      const textFontSize = toFiniteNumber(themeTextStyle.fontSize)
      return textFontSize === null ? 48 * 0.85 : textFontSize * 0.85
    })()

  const verseFontSize = Math.max(8, Math.round(verseFontBase * scaleY))
  const verseLineHeight =
    toFiniteNumber(themeTextStyle.verseLineHeight) ??
    toFiniteNumber(themeTextStyle.lineHeight) ??
    1.2

  if (typeof document === 'undefined') {
    return Math.max(14, Math.round(verseFontSize * verseLineHeight))
  }

  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.left = '-99999px'
  probe.style.top = '-99999px'
  probe.style.fontFamily =
    (themeTextStyle.verseFontFamily as string | undefined) ||
    (themeTextStyle.fontFamily as string | undefined) ||
    'Arial'
  probe.style.fontSize = `${verseFontSize}px`
  probe.style.fontWeight =
    (themeTextStyle.verseFontWeight as string | undefined) ||
    (themeTextStyle.fontWeight as string | undefined) ||
    'normal'
  probe.style.fontStyle =
    (themeTextStyle.verseFontStyle as string | undefined) ||
    (themeTextStyle.fontStyle as string | undefined) ||
    'normal'
  probe.style.textDecoration =
    (themeTextStyle.verseTextDecoration as string | undefined) ||
    (themeTextStyle.textDecoration as string | undefined) ||
    'none'
  probe.style.letterSpacing = `${
    toFiniteNumber(themeTextStyle.verseLetterSpacing) ??
    toFiniteNumber(themeTextStyle.letterSpacing) ??
    0
  }px`
  probe.style.lineHeight = String(verseLineHeight)
  probe.style.whiteSpace = 'nowrap'
  probe.textContent = 'A'

  document.body.appendChild(probe)
  const measuredHeight = Math.ceil(probe.getBoundingClientRect().height)
  document.body.removeChild(probe)

  return Math.max(
    14,
    Number.isFinite(measuredHeight) ? measuredHeight : Math.round(verseFontSize * verseLineHeight)
  )
}

export const mergeBoundsWithVerse = (
  textBounds: Bounds,
  verseBounds: Bounds | null,
  options?: { preserveTextWidth?: boolean }
): Bounds => {
  if (!verseBounds) return textBounds

  if (options?.preserveTextWidth) {
    const minY = Math.min(textBounds.y, verseBounds.y)
    const maxY = Math.max(textBounds.y + textBounds.height, verseBounds.y + verseBounds.height)

    return {
      x: Math.round(textBounds.x),
      y: Math.round(minY),
      width: Math.max(80, Math.round(textBounds.width)),
      height: Math.max(60, Math.round(maxY - minY))
    }
  }

  const minX = Math.min(textBounds.x, verseBounds.x)
  const minY = Math.min(textBounds.y, verseBounds.y)
  const maxX = Math.max(textBounds.x + textBounds.width, verseBounds.x + verseBounds.width)
  const maxY = Math.max(textBounds.y + textBounds.height, verseBounds.y + verseBounds.height)

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(80, Math.round(maxX - minX)),
    height: Math.max(60, Math.round(maxY - minY))
  }
}

const getVerseBoundsInCanvas = (
  themeTextStyle: Record<string, unknown>,
  bibleSettings: BiblePresentationSettingsInput | null | undefined,
  textBounds: Bounds
): Bounds | null => {
  const position = bibleSettings?.position
  if (!position) return null

  const scaleX = BASE_CANVAS_WIDTH / BASE_PRESENTATION_WIDTH
  const scaleY = BASE_CANVAS_HEIGHT / BASE_PRESENTATION_HEIGHT
  const verseHeight = measureVerseLineHeightInCanvas(themeTextStyle, scaleY)

  if (position === 'underText') {
    return {
      x: textBounds.x,
      y: textBounds.y + textBounds.height,
      width: textBounds.width,
      height: verseHeight
    }
  }

  if (position === 'overText') {
    return {
      x: textBounds.x,
      y: textBounds.y - verseHeight,
      width: textBounds.width,
      height: verseHeight
    }
  }

  if (position === 'upScreen' || position === 'downScreen') {
    const widthPercent = resolveBibleVerseWidthPercent(themeTextStyle.verseWidthPercent)
    const paddingInlineBase = (BASE_PRESENTATION_WIDTH * (100 - widthPercent)) / 200
    const translateXBase = resolveBibleVerseTranslateX(themeTextStyle.verseTranslateX)
    const clampedTranslateXBase = Math.max(
      -paddingInlineBase,
      Math.min(paddingInlineBase, translateXBase)
    )

    const clampedPositionStyle = Math.min(
      Math.max(0, Math.round(toFiniteNumber(bibleSettings.positionStyle) ?? 0)),
      MAX_BIBLE_EDGE_OFFSET_BASE
    )

    const verseWidthBase = BASE_PRESENTATION_WIDTH - 2 * paddingInlineBase
    const verseX = (paddingInlineBase + clampedTranslateXBase) * scaleX
    const edgeOffset = (clampedPositionStyle * BASE_CANVAS_HEIGHT) / BASE_PRESENTATION_HEIGHT
    const verseY =
      position === 'upScreen' ? edgeOffset : BASE_CANVAS_HEIGHT - edgeOffset - verseHeight

    return {
      x: Math.round(verseX),
      y: Math.round(verseY),
      width: Math.max(80, Math.round(verseWidthBase * scaleX)),
      height: verseHeight
    }
  }

  return null
}

export const mapThemeTextStyleToCanvasStyle = (
  themeTextStyle?: Record<string, unknown>,
  bibleSettings?: BiblePresentationSettingsInput | null
): Partial<CanvasItemStyle> | undefined => {
  if (!themeTextStyle) return undefined

  const scaleX = BASE_CANVAS_WIDTH / BASE_PRESENTATION_WIDTH
  const scaleY = BASE_CANVAS_HEIGHT / BASE_PRESENTATION_HEIGHT

  const paddingInline =
    typeof themeTextStyle.paddingInline === 'number' &&
    Number.isFinite(themeTextStyle.paddingInline)
      ? themeTextStyle.paddingInline
      : 16
  const paddingBlock =
    typeof themeTextStyle.paddingBlock === 'number' && Number.isFinite(themeTextStyle.paddingBlock)
      ? themeTextStyle.paddingBlock
      : 16
  const translate = parseTranslate(themeTextStyle.translate)

  const textBounds: Bounds = {
    x: Math.round(paddingInline * scaleX + translate.x * scaleX),
    y: Math.round(paddingBlock * scaleY + translate.y * scaleY),
    width: Math.max(80, Math.round(BASE_CANVAS_WIDTH - 2 * paddingInline * scaleX)),
    height: Math.max(60, Math.round(BASE_CANVAS_HEIGHT - 2 * paddingBlock * scaleY))
  }

  const verseBounds = getVerseBoundsInCanvas(themeTextStyle, bibleSettings, textBounds)
  const preserveThemeWidth =
    bibleSettings?.position === 'upScreen' || bibleSettings?.position === 'downScreen'
  const mergedBounds = mergeBoundsWithVerse(textBounds, verseBounds, {
    preserveTextWidth: preserveThemeWidth
  })

  const fontSizeBase =
    typeof themeTextStyle.fontSize === 'number' && Number.isFinite(themeTextStyle.fontSize)
      ? themeTextStyle.fontSize
      : 48

  const justifyContentRaw =
    typeof themeTextStyle.justifyContent === 'string' ? themeTextStyle.justifyContent : 'center'

  const verticalAlign: CanvasItemStyle['verticalAlign'] =
    justifyContentRaw === 'flex-start'
      ? 'top'
      : justifyContentRaw === 'flex-end'
        ? 'bottom'
        : 'center'

  const toScaledNumber = (value: unknown, scale: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value * scale : undefined

  return removeUndefinedFields({
    x: mergedBounds.x,
    y: mergedBounds.y,
    width: mergedBounds.width,
    height: mergedBounds.height,
    fontFamily: typeof themeTextStyle.fontFamily === 'string' ? themeTextStyle.fontFamily : 'Arial',
    fontSize: Math.max(8, Math.round(fontSizeBase * scaleY)),
    fontWeight:
      themeTextStyle.fontWeight === 'bold' || themeTextStyle.fontWeight === 'normal'
        ? themeTextStyle.fontWeight
        : undefined,
    color: typeof themeTextStyle.color === 'string' ? themeTextStyle.color : '#000000',
    textAlign:
      themeTextStyle.textAlign === 'left' ||
      themeTextStyle.textAlign === 'center' ||
      themeTextStyle.textAlign === 'right' ||
      themeTextStyle.textAlign === 'justify'
        ? themeTextStyle.textAlign
        : undefined,
    lineHeight:
      typeof themeTextStyle.lineHeight === 'number' && Number.isFinite(themeTextStyle.lineHeight)
        ? themeTextStyle.lineHeight
        : undefined,
    letterSpacing:
      typeof themeTextStyle.letterSpacing === 'number' &&
      Number.isFinite(themeTextStyle.letterSpacing)
        ? themeTextStyle.letterSpacing
        : undefined,
    verticalAlign,
    textShadowEnabled:
      typeof themeTextStyle.textShadowEnabled === 'boolean'
        ? themeTextStyle.textShadowEnabled
        : undefined,
    textShadowColor:
      typeof themeTextStyle.textShadowColor === 'string'
        ? themeTextStyle.textShadowColor
        : undefined,
    textShadowBlur: toScaledNumber(themeTextStyle.textShadowBlur, scaleY),
    textShadowOffsetX: toScaledNumber(themeTextStyle.textShadowOffsetX, scaleX),
    textShadowOffsetY: toScaledNumber(themeTextStyle.textShadowOffsetY, scaleY),
    textStrokeEnabled:
      typeof themeTextStyle.textStrokeEnabled === 'boolean'
        ? themeTextStyle.textStrokeEnabled
        : undefined,
    textStrokeColor:
      typeof themeTextStyle.textStrokeColor === 'string'
        ? themeTextStyle.textStrokeColor
        : undefined,
    textStrokeWidth: toScaledNumber(themeTextStyle.textStrokeWidth, scaleY),
    blockBgEnabled:
      typeof themeTextStyle.blockBgEnabled === 'boolean'
        ? themeTextStyle.blockBgEnabled
        : undefined,
    blockBgColor:
      typeof themeTextStyle.blockBgColor === 'string' ? themeTextStyle.blockBgColor : undefined,
    blockBgBlur: toScaledNumber(themeTextStyle.blockBgBlur, scaleY),
    blockBgPadding:
      typeof themeTextStyle.blockBgPadding === 'number' &&
      Number.isFinite(themeTextStyle.blockBgPadding)
        ? themeTextStyle.blockBgPadding * scaleY
        : undefined,
    blockBgOpacity:
      typeof themeTextStyle.blockBgOpacity === 'number' &&
      Number.isFinite(themeTextStyle.blockBgOpacity)
        ? themeTextStyle.blockBgOpacity
        : undefined,
    blockBgRadius: toScaledNumber(themeTextStyle.blockBgRadius, scaleY)
  })
}

export const getNoThemeBibleInsertStyle = (): Partial<CanvasItemStyle> => {
  const width = Math.round(BASE_CANVAS_WIDTH * 0.9)
  const height = Math.round(BASE_CANVAS_HEIGHT * 0.9)
  const x = Math.round((BASE_CANVAS_WIDTH - width) / 2)
  const y = Math.round((BASE_CANVAS_HEIGHT - height) / 2)

  return { x, y, width, height }
}
