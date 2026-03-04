import { UseFieldArrayAppend, UseFormSetValue } from 'react-hook-form'
import { Dispatch, SetStateAction } from 'react'
import { Media as PickerMedia } from '@/screens/panels/library/media/exports'
import { BibleTextSelection } from '../bibleTextPicker'
import { PresentationFormValues } from '../schema'
import {
  buildAutoSizedTextCanvasItemStyle,
  buildCanvasItemStyle,
  CanvasItemStyle,
  createMediaSlide,
  createSlideItem,
  createTextSlide,
  ensureSlideItems,
  getNextLayer,
  parseCanvasItemStyle,
  PresentationSlideItem
} from '../utils/slideUtils'
import { buildBibleAccessData, parseBibleAccessData } from '../utils/bibleAccessData'
import { generateUniqueId } from '@/lib/utils'

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
}>

type Params = {
  selectedSlide: PresentationFormValues['slides'][number] | undefined
  selectedSlideIndex: number
  selectedItem: PresentationSlideItem | undefined
  selectedItemStyle: CanvasItemStyle | undefined
  mediaPickerMode: 'insert-current' | 'replace-current'
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

export default function usePresentationEditorActions({
  selectedSlide,
  selectedSlideIndex,
  selectedItem,
  selectedItemStyle,
  mediaPickerMode,
  slidesLength,
  fieldsLength,
  setValue,
  appendSlide,
  setSelectedSlideIndex,
  setSelectedItemId,
  setMediaPickerMode,
  setIsMediaPickerOpen
}: Params) {
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
      customStyle: buildAutoSizedTextCanvasItemStyle(selection.text, undefined, {
        centerInCanvas: true
      })
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
      appendSlide(createMediaSlide(selectedMedia.id))
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
    const newItem = createSlideItem('TEXT', {
      text: 'Nuevo texto',
      layer: getNextLayer(items),
      customStyle: buildAutoSizedTextCanvasItemStyle('Nuevo texto', undefined, {
        centerInCanvas: true
      })
    })

    setValue(`slides.${selectedSlideIndex}.items`, [...items, newItem], { shouldDirty: true })
    setSelectedItemId(newItem.id)
  }

  const addEmptySlide = () => {
    appendSlide(createTextSlide())
    setSelectedSlideIndex(slidesLength)
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
    if (!selectedSlide?.items || selectedSlide.items.length <= 1) return
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
    addEmptySlide,
    updateItemLayerById,
    updateSelectedItemLayer,
    duplicateItemById,
    duplicateSelectedItem,
    removeItemById,
    removeSelectedItem
  }
}
