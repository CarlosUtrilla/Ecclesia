import { UseFieldArrayAppend, UseFormSetValue } from 'react-hook-form'
import { Dispatch, SetStateAction } from 'react'
import { Media as PickerMedia } from '@/screens/panels/library/media/exports'
import { BibleTextSelection } from '../bibleTextPicker'
import { PresentationFormValues } from '../schema'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { BASE_PRESENTATION_HEIGHT, BASE_PRESENTATION_WIDTH } from '@/lib/themeConstants'
import {
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  buildAutoSizedTextCanvasItemStyle,
  buildCanvasItemStyle,
  CanvasItemStyle,
  createMediaSlide,
  createShapeItem,
  createSlideItem,
  createTextSlide,
  ensureSlideItems,
  getNextLayer,
  withVideoLiveBehavior,
  parseCanvasItemStyle,
  PresentationShapeType,
  PresentationSlideItem
} from '../utils/slideUtils'
import {
  CanvaResolvedAsset,
  extractCanvaSlideNumber,
  getCanvaSourceKeyFromMp4Path,
  getCanvaSourceKeyFromZipPath,
  getCanvaZipFolderBaseName,
  getNextAvailableFolderName,
  sortCanvaResolvedAssets,
  splitCanvaImportSourcePaths
} from '../utils/canvaImport'
import { buildBibleAccessData, parseBibleAccessData } from '../utils/bibleAccessData'
import { generateUniqueId } from '@/lib/utils'
import { useThemes } from '@/hooks/useThemes'

type UpdateTextStyleInput = Partial<{
  fontFamily?: string
  fontSize?: number
  color?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
  textShadowEnabled?: boolean
  textShadowColor?: string
  textShadowBlur?: number
  textShadowOffsetX?: number
  textShadowOffsetY?: number
  textStrokeEnabled?: boolean
  textStrokeColor?: string
  textStrokeWidth?: number
  blockBgEnabled?: boolean
  blockBgColor?: string
  blockBgBlur?: number
  blockBgPadding?: number | null
  blockBgOpacity?: number
  blockBgRadius?: number
  shapeFill?: string
  shapeStroke?: string
  shapeStrokeWidth?: number
  shapeOpacity?: number
}>

type Params = {
  selectedSlide: PresentationFormValues['slides'][number] | undefined
  selectedSlideIndex: number
  selectedItem: PresentationSlideItem | undefined
  selectedItemStyle: CanvasItemStyle | undefined
  mediaPickerMode: 'insert-current' | 'replace-current'
  globalThemeId: number | null
  slides: PresentationFormValues['slides']
  slidesLength: number
  fieldsLength: number
  setValue: UseFormSetValue<PresentationFormValues>
  appendSlide: UseFieldArrayAppend<PresentationFormValues, 'slides'>
  setSelectedSlideIndex: Dispatch<SetStateAction<number>>
  setSelectedItemId: Dispatch<SetStateAction<string | undefined>>
  setMediaPickerMode: Dispatch<SetStateAction<'insert-current' | 'replace-current'>>
  setIsMediaPickerOpen: Dispatch<SetStateAction<boolean>>
}

const removeUndefinedFields = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>

type BiblePresentationSettingsInput = {
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

export const getNoThemeBibleInsertStyle = (): Partial<CanvasItemStyle> => {
  const width = Math.round(BASE_CANVAS_WIDTH * 0.9)
  const height = Math.round(BASE_CANVAS_HEIGHT * 0.9)
  const x = Math.round((BASE_CANVAS_WIDTH - width) / 2)
  const y = Math.round((BASE_CANVAS_HEIGHT - height) / 2)

  return { x, y, width, height }
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

const mapThemeTextStyleToCanvasStyle = (
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

export default function usePresentationEditorActions({
  selectedSlide,
  selectedSlideIndex,
  selectedItem,
  selectedItemStyle,
  mediaPickerMode,
  globalThemeId,
  slides,
  slidesLength,
  fieldsLength,
  setValue,
  appendSlide,
  setSelectedSlideIndex,
  setSelectedItemId,
  setMediaPickerMode,
  setIsMediaPickerOpen
}: Params) {
  const { themes } = useThemes()
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()
  const getThemeData = (themeId: number | null) => {
    if (themeId === null) return undefined
    return themes.find((theme) => theme.id === themeId)
  }
  const updateSelectedSlideItems = (
    updater: (items: PresentationSlideItem[]) => PresentationSlideItem[]
  ) => {
    if (!selectedSlide) return
    const nextItems = updater([...(selectedSlide.items || [])])
    setValue(`slides.${selectedSlideIndex}.items`, nextItems, { shouldDirty: true })
  }

  const updateSelectedItemStyle = (updates: Partial<CanvasItemStyle>) => {
    if (!selectedItem || !selectedItemStyle) return

    const nextStyle: CanvasItemStyle = {
      ...selectedItemStyle,
      ...updates
    }

    updateSelectedSlideItems((items) =>
      items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              customStyle: buildCanvasItemStyle(nextStyle, item.type)
            }
          : item
      )
    )
  }

  const updateItemStyleById = (itemId: string, updates: Partial<CanvasItemStyle>) => {
    if (!selectedSlide) return
    const item = selectedSlide.items?.find((entry) => entry.id === itemId)
    if (!item) return

    const current = parseCanvasItemStyle(item.customStyle, item.type)
    const merged = { ...current, ...removeUndefinedFields(updates) }

    updateSelectedSlideItems((items) =>
      items.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              customStyle: buildCanvasItemStyle(merged, entry.type)
            }
          : entry
      )
    )
  }

  const updateSelectedItem = (updates: Partial<PresentationSlideItem>) => {
    if (!selectedItem) return

    const safeUpdates = removeUndefinedFields(updates)
    if (Object.keys(safeUpdates).length === 0) return

    updateSelectedSlideItems((items) =>
      items.map((item) => (item.id === selectedItem.id ? { ...item, ...safeUpdates } : item))
    )
  }

  const updateSelectedTextStyle = (updates: UpdateTextStyleInput) => {
    if (!selectedItemStyle) return

    const next: Partial<CanvasItemStyle> = {}

    if (updates.fontFamily !== undefined) next.fontFamily = updates.fontFamily
    if (updates.fontSize !== undefined) next.fontSize = updates.fontSize
    if (updates.color !== undefined) next.color = updates.color
    if (updates.fontWeight !== undefined) next.fontWeight = updates.fontWeight
    if (updates.fontStyle !== undefined) next.fontStyle = updates.fontStyle
    if (updates.textDecoration !== undefined) next.textDecoration = updates.textDecoration
    if (updates.lineHeight !== undefined) next.lineHeight = updates.lineHeight
    if (updates.letterSpacing !== undefined) next.letterSpacing = updates.letterSpacing
    if (updates.textAlign !== undefined) next.textAlign = updates.textAlign
    if (updates.verticalAlign !== undefined) next.verticalAlign = updates.verticalAlign
    if (updates.textShadowEnabled !== undefined) next.textShadowEnabled = updates.textShadowEnabled
    if (updates.textShadowColor !== undefined) next.textShadowColor = updates.textShadowColor
    if (updates.textShadowBlur !== undefined) next.textShadowBlur = updates.textShadowBlur
    if (updates.textShadowOffsetX !== undefined) next.textShadowOffsetX = updates.textShadowOffsetX
    if (updates.textShadowOffsetY !== undefined) next.textShadowOffsetY = updates.textShadowOffsetY
    if (updates.textStrokeEnabled !== undefined) next.textStrokeEnabled = updates.textStrokeEnabled
    if (updates.textStrokeColor !== undefined) next.textStrokeColor = updates.textStrokeColor
    if (updates.textStrokeWidth !== undefined) next.textStrokeWidth = updates.textStrokeWidth
    if (updates.blockBgEnabled !== undefined) next.blockBgEnabled = updates.blockBgEnabled
    if (updates.blockBgColor !== undefined) next.blockBgColor = updates.blockBgColor
    if (updates.blockBgBlur !== undefined) next.blockBgBlur = updates.blockBgBlur
    if (updates.blockBgPadding !== undefined) next.blockBgPadding = updates.blockBgPadding
    if (updates.blockBgOpacity !== undefined) next.blockBgOpacity = updates.blockBgOpacity
    if (updates.blockBgRadius !== undefined) next.blockBgRadius = updates.blockBgRadius
    if (updates.shapeFill !== undefined) next.shapeFill = updates.shapeFill
    if (updates.shapeStroke !== undefined) next.shapeStroke = updates.shapeStroke
    if (updates.shapeStrokeWidth !== undefined) next.shapeStrokeWidth = updates.shapeStrokeWidth
    if (updates.shapeOpacity !== undefined) next.shapeOpacity = updates.shapeOpacity

    if (updates.offsetX !== undefined) next.x = 220 + updates.offsetX
    if (updates.offsetY !== undefined) next.y = 180 + updates.offsetY

    updateSelectedItemStyle(next)
  }

  const loadBibleText = async () => {
    if (!selectedItem || selectedItem.type !== 'BIBLE') return

    const bible = parseBibleAccessData(selectedItem.accessData)
    const endVerse = bible.verseEnd ?? bible.verseStart
    const verses = Array.from(
      { length: endVerse - bible.verseStart + 1 },
      (_, index) => bible.verseStart + index
    )

    const result = await window.api.bible.getVerses({
      book: bible.bookId,
      chapter: bible.chapter,
      verses,
      version: bible.version
    })

    const bibleText = result.map((verse) => `${verse.verse}. ${verse.text}`).join('<br/>')

    updateSelectedItem({
      text: bibleText
    })

    if (selectedItemStyle) {
      updateSelectedItemStyle({
        height: parseCanvasItemStyle(
          buildAutoSizedTextCanvasItemStyle(bibleText, selectedItemStyle),
          'TEXT'
        ).height
      })
    }
  }

  const handleAddBibleToPresentation = (selection: BibleTextSelection) => {
    if (!selectedSlide) return

    const items = ensureSlideItems(selectedSlide)
    const themeData = getThemeData(globalThemeId)

    const themeStyle = themeData?.textStyle as Record<string, unknown> | undefined
    const effectiveBibleSettings = themeData?.useDefaultBibleSettings
      ? (defaultBiblePresentationSettings as BiblePresentationSettingsInput | undefined)
      : (themeData?.biblePresentationSettings as BiblePresentationSettingsInput | undefined)

    const initialStyle = mapThemeTextStyleToCanvasStyle(themeStyle, effectiveBibleSettings)

    const newItem = createSlideItem('BIBLE', {
      text: selection.text,
      accessData: buildBibleAccessData({
        bookId: selection.bookId,
        chapter: selection.chapter,
        verseStart: selection.verseStart,
        verseEnd: selection.verseEnd,
        version: selection.version
      }),
      layer: getNextLayer(items),
      customStyle: initialStyle
        ? buildCanvasItemStyle(
            {
              ...parseCanvasItemStyle(undefined, 'TEXT'),
              ...initialStyle
            },
            'TEXT'
          )
        : buildCanvasItemStyle(
            {
              ...parseCanvasItemStyle(undefined, 'TEXT'),
              ...getNoThemeBibleInsertStyle()
            },
            'TEXT'
          )
    })

    setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], { shouldDirty: true })
    setSelectedItemId(newItem.id)
  }

  const insertMediaItem = () => {
    setMediaPickerMode('insert-current')
    setIsMediaPickerOpen(true)
  }

  const replaceSelectedMedia = () => {
    setMediaPickerMode('replace-current')
    setIsMediaPickerOpen(true)
  }

  const handleSelectMedia = (selectedMedia: PickerMedia) => {
    if (!selectedSlide) {
      appendSlide(createMediaSlide(selectedMedia.id, globalThemeId))
      setSelectedSlideIndex(fieldsLength)
      return
    }

    const items = ensureSlideItems(selectedSlide)

    if (mediaPickerMode === 'replace-current' && selectedItem?.type === 'MEDIA') {
      updateSelectedItem({ accessData: String(selectedMedia.id) })
      return
    }

    const newItem = createSlideItem('MEDIA', {
      accessData: String(selectedMedia.id),
      layer: getNextLayer(items)
    })

    setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], { shouldDirty: true })
    setSelectedItemId(newItem.id)
  }

  const insertTextInCurrentSlide = () => {
    if (!selectedSlide) return

    const items = ensureSlideItems(selectedSlide)
    const themeData = getThemeData(globalThemeId)

    const themeStyle = themeData?.textStyle as Record<string, unknown> | undefined
    const initialStyle = mapThemeTextStyleToCanvasStyle(themeStyle)

    const newItem = createSlideItem('TEXT', {
      text: 'Nuevo texto',
      layer: getNextLayer(items),
      customStyle: initialStyle
        ? buildCanvasItemStyle(
            {
              ...parseCanvasItemStyle(undefined, 'TEXT'),
              ...initialStyle
            },
            'TEXT'
          )
        : buildAutoSizedTextCanvasItemStyle('Nuevo texto', undefined, {
            centerInCanvas: true
          })
    })

    setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], { shouldDirty: true })
    setSelectedItemId(newItem.id)
  }

  const insertShapeInCurrentSlide = (shapeType: PresentationShapeType) => {
    if (!selectedSlide) return

    const items = ensureSlideItems(selectedSlide)
    const newItem = createShapeItem(shapeType, {
      layer: getNextLayer(items)
    })

    setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], { shouldDirty: true })
    setSelectedItemId(newItem.id)
  }

  const addEmptySlide = () => {
    appendSlide(createTextSlide(globalThemeId))
    setSelectedSlideIndex(slidesLength)
  }

  const createCanvaFullSlide = (mediaId: number, themeId?: number | null) => {
    const baseSlide = withVideoLiveBehavior(createMediaSlide(mediaId, themeId), 'auto')
    const baseItem = baseSlide.items[0]

    if (!baseItem) {
      return {
        ...baseSlide,
        textStyle: {
          ...baseSlide.textStyle,
          mediaWidth: 100,
          mediaHeight: 100,
          offsetX: 0,
          offsetY: 0
        }
      }
    }

    const currentStyle = parseCanvasItemStyle(baseItem.customStyle, 'MEDIA')
    const fullStyle = buildCanvasItemStyle(
      {
        ...currentStyle,
        x: 0,
        y: 0,
        width: BASE_CANVAS_WIDTH,
        height: BASE_CANVAS_HEIGHT
      },
      'MEDIA'
    )

    return {
      ...baseSlide,
      items: [
        {
          ...baseItem,
          customStyle: fullStyle
        }
      ],
      textStyle: {
        ...baseSlide.textStyle,
        mediaWidth: 100,
        mediaHeight: 100,
        offsetX: 0,
        offsetY: 0
      }
    }
  }

  const importCanvaAssetsAsSlides = async () => {
    const selectedPaths = await window.mediaAPI.selectFiles('all')
    if (selectedPaths.length === 0) return

    const { mp4Paths, zipPaths, rejectedPaths } = splitCanvaImportSourcePaths(selectedPaths)

    const rootFolders = await window.mediaAPI.listFolders(undefined)
    const occupiedFolderNames = new Set(rootFolders)

    const resolvedMp4Paths: CanvaResolvedAsset[] = mp4Paths.map((filePath) => ({
      filePath,
      sourceKey: getCanvaSourceKeyFromMp4Path(filePath),
      slideNumber: extractCanvaSlideNumber(filePath)
    }))
    const tempDirsToCleanup: string[] = []
    let zipWithoutMp4Count = 0
    let zipExtractionFailureCount = 0

    for (const zipPath of zipPaths) {
      try {
        const folderBaseName = getCanvaZipFolderBaseName(zipPath)
        const folderName = getNextAvailableFolderName(folderBaseName, occupiedFolderNames)
        occupiedFolderNames.add(folderName)
        await window.mediaAPI.createFolder(folderName)

        const extracted = await window.mediaAPI.extractZipMp4(zipPath)
        tempDirsToCleanup.push(extracted.tempDir)

        if (extracted.mp4Paths.length === 0) {
          zipWithoutMp4Count += 1
          continue
        }

        resolvedMp4Paths.push(
          ...extracted.mp4Paths.map((filePath) => ({
            filePath,
            folder: folderName,
            sourceKey: getCanvaSourceKeyFromZipPath(zipPath),
            slideNumber: extractCanvaSlideNumber(filePath)
          }))
        )
      } catch {
        zipExtractionFailureCount += 1
      }
    }

    if (resolvedMp4Paths.length === 0) {
      const baseMessage = 'No se encontraron videos .mp4 para importar.'

      const details: string[] = []
      if (zipWithoutMp4Count > 0) {
        details.push(`${zipWithoutMp4Count} ZIP sin MP4`)
      }
      if (zipExtractionFailureCount > 0) {
        details.push(`${zipExtractionFailureCount} ZIP con error de extracción`)
      }

      for (const tempDir of tempDirsToCleanup) {
        try {
          await window.mediaAPI.cleanupTempPath(tempDir)
        } catch {
          // Ignorar errores de limpieza temporal para no bloquear la UX.
        }
      }

      alert(details.length > 0 ? `${baseMessage} (${details.join(', ')}).` : baseMessage)
      return
    }

    const sortedAssets = sortCanvaResolvedAssets(resolvedMp4Paths)
    const importedAssets: Array<{
      mediaId: number
      sourceKey: string
      slideNumber: number | null
    }> = []
    let failedImports = 0

    for (const entry of sortedAssets) {
      try {
        const importedFile = await window.mediaAPI.importFile(entry.filePath, entry.folder)
        const mediaRecord = await window.api.media.create(importedFile)
        importedAssets.push({
          mediaId: mediaRecord.id,
          sourceKey: entry.sourceKey,
          slideNumber: entry.slideNumber
        })
      } catch {
        failedImports += 1
      }
    }

    if (importedAssets.length === 0) {
      alert('No se pudo importar ningún video MP4 de Canva.')

      for (const tempDir of tempDirsToCleanup) {
        try {
          await window.mediaAPI.cleanupTempPath(tempDir)
        } catch {
          // Ignorar errores de limpieza temporal para no bloquear la UX.
        }
      }

      return
    }

    const nextSlides = [...slides]
    const canvaSlotToIndex = new Map<string, number>()

    for (let index = 0; index < nextSlides.length; index += 1) {
      const slide = nextSlides[index]
      if (!slide.canvaSourceKey || !slide.canvaSlideNumber) continue
      canvaSlotToIndex.set(
        `${slide.canvaSourceKey.toLowerCase()}::${slide.canvaSlideNumber}`,
        index
      )
    }

    let updatedSlidesCount = 0
    let appendedSlidesCount = 0

    for (const asset of importedAssets) {
      const hasStableSlot = asset.slideNumber !== null
      const slotKey = hasStableSlot ? `${asset.sourceKey}::${asset.slideNumber}` : ''
      const existingIndex = hasStableSlot ? canvaSlotToIndex.get(slotKey) : undefined

      if (existingIndex !== undefined) {
        const currentSlide = nextSlides[existingIndex]
        const replacement = createCanvaFullSlide(
          asset.mediaId,
          currentSlide.themeId ?? globalThemeId
        )

        nextSlides[existingIndex] = {
          ...replacement,
          id: currentSlide.id,
          themeId: currentSlide.themeId ?? globalThemeId ?? null,
          transitionSettings: currentSlide.transitionSettings || replacement.transitionSettings,
          videoLoop: currentSlide.videoLoop === true,
          videoLiveBehavior: currentSlide.videoLiveBehavior || replacement.videoLiveBehavior,
          canvaSourceKey: asset.sourceKey,
          canvaSlideNumber: asset.slideNumber ?? undefined
        }
        updatedSlidesCount += 1
        continue
      }

      const created = createCanvaFullSlide(asset.mediaId, globalThemeId)
      const createdWithCanvaMeta = {
        ...created,
        canvaSourceKey: asset.sourceKey,
        canvaSlideNumber: asset.slideNumber ?? undefined
      }

      nextSlides.push(createdWithCanvaMeta)
      appendedSlidesCount += 1

      if (hasStableSlot) {
        canvaSlotToIndex.set(slotKey, nextSlides.length - 1)
      }
    }

    setValue('slides', nextSlides, { shouldDirty: true })
    const lastSlide = nextSlides[nextSlides.length - 1]
    setSelectedSlideIndex(nextSlides.length - 1)
    setSelectedItemId(lastSlide?.items?.[0]?.id)

    const skippedByFormat = rejectedPaths.length
    const importedCount = importedAssets.length

    for (const tempDir of tempDirsToCleanup) {
      try {
        await window.mediaAPI.cleanupTempPath(tempDir)
      } catch {
        // Ignorar errores de limpieza temporal para no bloquear la UX.
      }
    }

    if (
      failedImports === 0 &&
      skippedByFormat === 0 &&
      zipWithoutMp4Count === 0 &&
      zipExtractionFailureCount === 0
    ) {
      window.electron.ipcRenderer.send('media-saved')
      const parts = [`Se importaron ${importedCount} videos.`]
      if (updatedSlidesCount > 0) parts.push(`${updatedSlidesCount} diapositiva(s) actualizada(s).`)
      if (appendedSlidesCount > 0) parts.push(`${appendedSlidesCount} diapositiva(s) agregada(s).`)
      alert(parts.join(' '))
      return
    }

    const parts = [`Se importaron ${importedCount} videos.`]
    if (updatedSlidesCount > 0) parts.push(`${updatedSlidesCount} diapositiva(s) actualizada(s).`)
    if (appendedSlidesCount > 0) parts.push(`${appendedSlidesCount} diapositiva(s) agregada(s).`)

    if (skippedByFormat > 0) {
      parts.push(`Se omitieron ${skippedByFormat} archivo(s) por no ser .mp4.`)
    }

    if (zipWithoutMp4Count > 0) {
      parts.push(`${zipWithoutMp4Count} ZIP no contenía videos .mp4.`)
    }

    if (zipExtractionFailureCount > 0) {
      parts.push(`Falló la extracción de ${zipExtractionFailureCount} ZIP.`)
    }

    if (failedImports > 0) {
      parts.push(`Fallaron ${failedImports} importación(es).`)
    }

    window.electron.ipcRenderer.send('media-saved')
    alert(parts.join(' '))
  }

  const updateItemLayerById = (itemId: string, direction: 'up' | 'down') => {
    if (!selectedSlide?.items) return
    const targetItem = selectedSlide.items.find((item) => item.id === itemId)
    if (!targetItem) return

    const maxLayer = Math.max(...selectedSlide.items.map((item) => Number(item.layer || 0)))
    const minLayer = Math.min(...selectedSlide.items.map((item) => Number(item.layer || 0)))
    const currentLayer = Number(targetItem.layer || 0)

    if (direction === 'up' && currentLayer >= maxLayer) return
    if (direction === 'down' && currentLayer <= minLayer) return

    const nextLayer = direction === 'up' ? currentLayer + 1 : currentLayer - 1
    const swapItem = selectedSlide.items.find((item) => Number(item.layer || 0) === nextLayer)

    updateSelectedSlideItems((items) =>
      items.map((item) => {
        if (item.id === targetItem.id) return { ...item, layer: nextLayer }
        if (swapItem && item.id === swapItem.id) return { ...item, layer: currentLayer }
        return item
      })
    )

    setSelectedItemId(targetItem.id)
  }

  const updateSelectedItemLayer = (direction: 'up' | 'down') => {
    if (!selectedItem) return
    updateItemLayerById(selectedItem.id, direction)
  }

  const duplicateItemById = (itemId: string) => {
    if (!selectedSlide) return
    const targetItem = selectedSlide.items?.find((item) => item.id === itemId)
    if (!targetItem) return

    const items = ensureSlideItems(selectedSlide)
    const nextStyle = parseCanvasItemStyle(targetItem.customStyle, targetItem.type)
    const duplicated: PresentationSlideItem = {
      ...targetItem,
      id: generateUniqueId(),
      layer: getNextLayer(items),
      customStyle: buildCanvasItemStyle(
        { ...nextStyle, x: nextStyle.x + 20, y: nextStyle.y + 20 },
        targetItem.type
      )
    }

    setValue(`slides.${selectedSlideIndex}.items`, [...items, duplicated], { shouldDirty: true })
    setSelectedItemId(duplicated.id)
  }

  const duplicateSelectedItem = () => {
    if (!selectedItem) return
    duplicateItemById(selectedItem.id)
  }

  const removeItemById = (itemId: string) => {
    if (!selectedSlide?.items) return
    const nextItems = selectedSlide.items.filter((item) => item.id !== itemId)
    setValue(`slides.${selectedSlideIndex}.items`, nextItems, { shouldDirty: true })
    setSelectedItemId(nextItems[nextItems.length - 1]?.id)
  }

  const removeSelectedItem = () => {
    if (!selectedItem) return
    removeItemById(selectedItem.id)
  }

  return {
    updateSelectedSlideItems,
    updateSelectedItemStyle,
    updateItemStyleById,
    updateSelectedItem,
    updateSelectedTextStyle,
    loadBibleText,
    handleAddBibleToPresentation,
    insertMediaItem,
    replaceSelectedMedia,
    handleSelectMedia,
    insertTextInCurrentSlide,
    insertShapeInCurrentSlide,
    addEmptySlide,
    importCanvaAssetsAsSlides,
    updateItemLayerById,
    updateSelectedItemLayer,
    duplicateItemById,
    duplicateSelectedItem,
    removeItemById,
    removeSelectedItem
  }
}
