import { generateUniqueId, sanitizeHTML } from '@/lib/utils'
import { PresentationFormValues } from '../schema'

export type PresentationSlide = PresentationFormValues['slides'][number]
export type PresentationSlideItem = NonNullable<PresentationSlide['items']>[number]

export const BASE_CANVAS_WIDTH = 1280
export const BASE_CANVAS_HEIGHT = 720
export const defaultTransitionSettingsString =
  '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}'

export type CanvasItemStyle = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fontSize: number
  fontFamily: string
  lineHeight: number
  letterSpacing: number
  color: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  verticalAlign: 'top' | 'center' | 'bottom'
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline'
}

export const baseTextStyle = {
  fontSize: 48,
  fontFamily: 'Arial',
  lineHeight: 1.2,
  letterSpacing: 0,
  color: '#000000',
  textAlign: 'center' as const,
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  textDecoration: 'none' as const,
  offsetX: 0,
  offsetY: 0,
  mediaWidth: 70,
  mediaHeight: 70
}

const defaultTextCanvasStyle: CanvasItemStyle = {
  x: 220,
  y: 180,
  width: 920,
  height: 220,
  rotation: 0,
  fontSize: 48,
  fontFamily: 'Arial',
  lineHeight: 1.2,
  letterSpacing: 0,
  color: '#000000',
  textAlign: 'center',
  verticalAlign: 'center',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none'
}

const defaultMediaCanvasStyle: CanvasItemStyle = {
  ...defaultTextCanvasStyle,
  x: 320,
  y: 140,
  width: 640,
  height: 360
}

const estimateTextHeightWithDOM = (text: string, style: CanvasItemStyle) => {
  if (typeof document === 'undefined') return style.height

  const measurementNode = document.createElement('div')
  measurementNode.style.position = 'absolute'
  measurementNode.style.visibility = 'hidden'
  measurementNode.style.pointerEvents = 'none'
  measurementNode.style.left = '-99999px'
  measurementNode.style.top = '-99999px'
  measurementNode.style.width = `${Math.max(80, Math.round(style.width))}px`
  measurementNode.style.boxSizing = 'border-box'
  measurementNode.style.padding = '8px'
  measurementNode.style.fontSize = `${style.fontSize}px`
  measurementNode.style.fontFamily = style.fontFamily
  measurementNode.style.lineHeight = String(style.lineHeight)
  measurementNode.style.letterSpacing = `${style.letterSpacing}px`
  measurementNode.style.fontWeight = style.fontWeight
  measurementNode.style.fontStyle = style.fontStyle
  measurementNode.style.textDecoration = style.textDecoration
  measurementNode.style.whiteSpace = 'normal'
  measurementNode.style.wordBreak = 'break-word'
  measurementNode.style.overflowWrap = 'anywhere'
  measurementNode.innerHTML = sanitizeHTML(text || '') || '&nbsp;'

  document.body.appendChild(measurementNode)
  const measuredHeight = measurementNode.scrollHeight
  document.body.removeChild(measurementNode)

  return Number.isFinite(measuredHeight) ? measuredHeight : style.height
}

export const getAutoSizedTextStyle = (
  text: string,
  baseStyle?: Partial<CanvasItemStyle>,
  options?: {
    centerInCanvas?: boolean
  }
): CanvasItemStyle => {
  const mergedStyle: CanvasItemStyle = {
    ...defaultTextCanvasStyle,
    ...baseStyle
  }

  const measuredHeight = estimateTextHeightWithDOM(text, mergedStyle)
  const nextHeight = Math.max(60, Math.min(620, Math.ceil(measuredHeight)))

  const centeredX = Math.round((BASE_CANVAS_WIDTH - mergedStyle.width) / 2)
  const centeredY = Math.round((BASE_CANVAS_HEIGHT - nextHeight) / 2)

  return {
    ...mergedStyle,
    height: nextHeight,
    x: options?.centerInCanvas ? centeredX : mergedStyle.x,
    y: options?.centerInCanvas ? centeredY : mergedStyle.y
  }
}

export const buildAutoSizedTextCanvasItemStyle = (
  text: string,
  baseStyle?: Partial<CanvasItemStyle>,
  options?: {
    centerInCanvas?: boolean
  }
) => buildCanvasItemStyle(getAutoSizedTextStyle(text, baseStyle, options), 'TEXT')

const parseInlineStyle = (styleText?: string) => {
  if (!styleText) return {} as Record<string, string>

  return styleText
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, declaration) => {
      const [rawProperty, ...valueParts] = declaration.split(':')
      const property = rawProperty?.trim()
      const value = valueParts.join(':').trim()
      if (!property || !value) return acc
      acc[property] = value
      return acc
    }, {})
}

const parsePx = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(String(value).replace('px', '').trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseRotate = (transform?: string) => {
  if (!transform) return 0
  const rotateMatch = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)
  if (!rotateMatch?.[1]) return 0
  const parsed = Number(rotateMatch[1])
  return Number.isFinite(parsed) ? parsed : 0
}

export const parseCanvasItemStyle = (
  customStyle?: string,
  itemType: PresentationSlideItem['type'] = 'TEXT'
): CanvasItemStyle => {
  const styleMap = parseInlineStyle(customStyle)
  const base = itemType === 'MEDIA' ? defaultMediaCanvasStyle : defaultTextCanvasStyle

  return {
    x: parsePx(styleMap.left, base.x),
    y: parsePx(styleMap.top, base.y),
    width: Math.max(80, parsePx(styleMap.width, base.width)),
    height: Math.max(60, parsePx(styleMap.height, base.height)),
    rotation: parseRotate(styleMap.transform),
    fontSize: parsePx(styleMap['font-size'], base.fontSize),
    fontFamily: styleMap['font-family'] || base.fontFamily,
    lineHeight: parseNumber(styleMap['line-height'], base.lineHeight),
    letterSpacing: parsePx(styleMap['letter-spacing'], base.letterSpacing),
    color: styleMap.color || base.color,
    textAlign: (styleMap['text-align'] as CanvasItemStyle['textAlign']) || base.textAlign,
    verticalAlign:
      styleMap['align-items'] === 'flex-start'
        ? 'top'
        : styleMap['align-items'] === 'flex-end'
          ? 'bottom'
          : base.verticalAlign,
    fontWeight: (styleMap['font-weight'] as CanvasItemStyle['fontWeight']) || base.fontWeight,
    fontStyle: (styleMap['font-style'] as CanvasItemStyle['fontStyle']) || base.fontStyle,
    textDecoration:
      (styleMap['text-decoration'] as CanvasItemStyle['textDecoration']) || base.textDecoration
  }
}

export const buildCanvasItemStyle = (
  style: CanvasItemStyle,
  itemType: PresentationSlideItem['type']
) => {
  const common = [
    'position: absolute',
    'inset: auto',
    `left: ${Math.round(style.x)}px`,
    `top: ${Math.round(style.y)}px`,
    `width: ${Math.max(80, Math.round(style.width))}px`,
    `height: ${Math.max(60, Math.round(style.height))}px`,
    `transform: rotate(${style.rotation}deg)`
  ]

  if (itemType === 'MEDIA') {
    return [...common, 'overflow: hidden', 'display: block'].join('; ')
  }

  return [
    ...common,
    'display: flex',
    `align-items: ${
      style.verticalAlign === 'top'
        ? 'flex-start'
        : style.verticalAlign === 'bottom'
          ? 'flex-end'
          : 'center'
    }`,
    'justify-content: center',
    `font-size: ${style.fontSize}px`,
    `font-family: ${style.fontFamily}`,
    `line-height: ${style.lineHeight}`,
    `letter-spacing: ${style.letterSpacing}px`,
    `color: ${style.color}`,
    `text-align: ${style.textAlign}`,
    `font-weight: ${style.fontWeight}`,
    `font-style: ${style.fontStyle}`,
    `text-decoration: ${style.textDecoration}`
  ].join('; ')
}

export const createSlideItem = (
  type: PresentationSlideItem['type'],
  partial?: Partial<PresentationSlideItem>
): PresentationSlideItem => ({
  id: partial?.id || generateUniqueId(),
  type,
  text: partial?.text,
  accessData: partial?.accessData,
  layer: Number(partial?.layer || 0),
  animationSettings: partial?.animationSettings,
  customStyle:
    partial?.customStyle ||
    buildCanvasItemStyle(type === 'MEDIA' ? defaultMediaCanvasStyle : defaultTextCanvasStyle, type)
})

export const ensureSlideItems = (slide: PresentationSlide): PresentationSlideItem[] => {
  if (Array.isArray(slide.items)) {
    if (slide.items.length === 0) {
      return []
    }

    return slide.items.map((item, index) => ({
      ...item,
      id: item.id || `${slide.id}-item-${index}`,
      layer: Number(item.layer || index),
      customStyle:
        item.customStyle ||
        buildCanvasItemStyle(
          item.type === 'MEDIA' ? defaultMediaCanvasStyle : defaultTextCanvasStyle,
          item.type
        )
    }))
  }

  return [buildPrimaryItemFromSlide(slide)]
}

export const getNextLayer = (items: PresentationSlideItem[]) => {
  const layers = items.map((item) => Number(item.layer || 0))
  return layers.length > 0 ? Math.max(...layers) + 1 : 0
}

export const createTextSlide = (themeId?: number | null) => ({
  id: generateUniqueId(),
  type: 'TEXT' as const,
  themeId: themeId ?? null,
  transitionSettings: defaultTransitionSettingsString,
  videoLiveBehavior: 'manual' as const,
  text: 'Nuevo texto',
  items: [
    createSlideItem('TEXT', {
      text: 'Nuevo texto',
      layer: 0,
      customStyle: buildAutoSizedTextCanvasItemStyle('Nuevo texto', undefined, {
        centerInCanvas: true
      })
    })
  ],
  textStyle: { ...baseTextStyle }
})

export const createMediaSlide = (mediaId?: number, themeId?: number | null) => ({
  id: generateUniqueId(),
  type: 'MEDIA' as const,
  themeId: themeId ?? null,
  transitionSettings: defaultTransitionSettingsString,
  videoLiveBehavior: 'manual' as const,
  text: '',
  mediaId,
  items: [
    createSlideItem('MEDIA', {
      accessData: mediaId ? String(mediaId) : '',
      layer: 0
    })
  ],
  textStyle: { ...baseTextStyle }
})

export const buildLegacyStyleFromSlide = (slide: PresentationFormValues['slides'][number]) => {
  if (!slide.textStyle) return ''

  const styles: string[] = []
  if (slide.textStyle.fontSize) styles.push(`font-size: ${slide.textStyle.fontSize}px`)
  if (slide.textStyle.fontFamily) styles.push(`font-family: ${slide.textStyle.fontFamily}`)
  if (slide.textStyle.lineHeight) styles.push(`line-height: ${slide.textStyle.lineHeight}`)
  if (slide.textStyle.letterSpacing !== undefined) {
    styles.push(`letter-spacing: ${slide.textStyle.letterSpacing}px`)
  }
  if (slide.textStyle.color) styles.push(`color: ${slide.textStyle.color}`)
  if (slide.textStyle.textAlign) styles.push(`text-align: ${slide.textStyle.textAlign}`)
  if (slide.textStyle.fontWeight) styles.push(`font-weight: ${slide.textStyle.fontWeight}`)
  if (slide.textStyle.fontStyle) styles.push(`font-style: ${slide.textStyle.fontStyle}`)
  if (slide.textStyle.textDecoration) {
    styles.push(`text-decoration: ${slide.textStyle.textDecoration}`)
  }

  const offsetX = Number(slide.textStyle.offsetX || 0)
  const offsetY = Number(slide.textStyle.offsetY || 0)
  if (offsetX !== 0 || offsetY !== 0) {
    styles.push(`transform: translate(${offsetX}px, ${offsetY}px)`)
  }

  return styles.join('; ')
}

export const buildPrimaryItemFromSlide = (slide: PresentationFormValues['slides'][number]) => {
  const fromLegacy: CanvasItemStyle = {
    ...(slide.type === 'MEDIA' ? defaultMediaCanvasStyle : defaultTextCanvasStyle),
    fontSize: Number(slide.textStyle?.fontSize || defaultTextCanvasStyle.fontSize),
    fontFamily: slide.textStyle?.fontFamily || defaultTextCanvasStyle.fontFamily,
    lineHeight: Number(slide.textStyle?.lineHeight || defaultTextCanvasStyle.lineHeight),
    letterSpacing: Number(slide.textStyle?.letterSpacing || defaultTextCanvasStyle.letterSpacing),
    color: slide.textStyle?.color || defaultTextCanvasStyle.color,
    textAlign: slide.textStyle?.textAlign || defaultTextCanvasStyle.textAlign,
    fontWeight: slide.textStyle?.fontWeight || defaultTextCanvasStyle.fontWeight,
    fontStyle: slide.textStyle?.fontStyle || defaultTextCanvasStyle.fontStyle,
    textDecoration: slide.textStyle?.textDecoration || defaultTextCanvasStyle.textDecoration,
    x: 220 + Number(slide.textStyle?.offsetX || 0),
    y: 180 + Number(slide.textStyle?.offsetY || 0),
    width:
      slide.type === 'MEDIA'
        ? Math.round((1280 * Number(slide.textStyle?.mediaWidth || 70)) / 100)
        : defaultTextCanvasStyle.width,
    height:
      slide.type === 'MEDIA'
        ? Math.round((720 * Number(slide.textStyle?.mediaHeight || 70)) / 100)
        : defaultTextCanvasStyle.height
  }

  const base = {
    id: slide.items?.[0]?.id || generateUniqueId(),
    customStyle: buildCanvasItemStyle(fromLegacy, slide.type),
    layer: Number(slide.items?.[0]?.layer || 0),
    animationSettings: slide.items?.[0]?.animationSettings
  }

  if (slide.type === 'MEDIA') {
    return {
      ...base,
      type: 'MEDIA' as const,
      accessData: slide.mediaId ? String(slide.mediaId) : '',
      text: ''
    }
  }

  if (slide.type === 'BIBLE') {
    const bible = slide.bible
    const verseRange = bible?.verseEnd
      ? `${bible.verseStart}-${bible.verseEnd}`
      : `${bible?.verseStart || 1}`

    return {
      ...base,
      type: 'BIBLE' as const,
      accessData: `${bible?.bookId || 1},${bible?.chapter || 1},${verseRange},${bible?.version || 'RVR1960'}`,
      text: slide.text || ''
    }
  }

  return {
    ...base,
    type: 'TEXT' as const,
    text: slide.text || ''
  }
}
