import { UseFormSetValue } from 'react-hook-form'
import { Dispatch, SetStateAction } from 'react'
import { BibleTextSelection } from '../bibleTextPicker'
import { PresentationFormValues } from '../schema'
import {
  buildCanvasItemStyle,
  buildAutoSizedTextCanvasItemStyle,
  CanvasItemStyle,
  createSlideItem,
  ensureSlideItems,
  getNextLayer,
  parseCanvasItemStyle,
  PresentationSlideItem
} from '../utils/slideUtils'
import { buildBibleAccessData, parseBibleAccessData } from '../utils/bibleAccessData'
import {
  BiblePresentationSettingsInput,
  mapThemeTextStyleToCanvasStyle,
  getNoThemeBibleInsertStyle
} from '../utils/themeStyleMapping'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'
import { useThemes } from '@/hooks/useThemes'
import { Api } from '@ecclesia/queries'

type Params = {
  selectedSlide: PresentationFormValues['slides'][number] | undefined
  selectedSlideIndex: number
  selectedItem: PresentationSlideItem | undefined
  selectedItemStyle: CanvasItemStyle | undefined
  globalThemeId: number | null
  setValue: UseFormSetValue<PresentationFormValues>
  setSelectedItemId: Dispatch<SetStateAction<string | undefined>>
}

type Actions = {
  updateSelectedItem: (updates: Partial<PresentationSlideItem>) => void
  updateSelectedItemStyle: (updates: Partial<CanvasItemStyle>) => void
}

export default function useBibleInsertionActions(
  params: Params,
  actions: Actions
) {
  const {
    selectedSlide,
    selectedSlideIndex,
    selectedItem,
    selectedItemStyle,
    globalThemeId,
    setValue,
    setSelectedItemId
  } = params

  const { updateSelectedItem, updateSelectedItemStyle } = actions

  const { themes } = useThemes()
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()

  const getThemeData = (themeId: number | null) => {
    if (themeId === null) return undefined
    return themes.find((theme) => theme.id === themeId)
  }

  const loadBibleText = async () => {
    if (!selectedItem || selectedItem.type !== 'BIBLE') return

    const bible = parseBibleAccessData(selectedItem.accessData)
    const endVerse = bible.verseEnd ?? bible.verseStart
    const verses = Array.from(
      { length: endVerse - bible.verseStart + 1 },
      (_, index) => bible.verseStart + index
    )

    const result = await Api.fetch.bible.getVerses({
      body: {
        book: bible.bookId,
        chapter: bible.chapter,
        verses,
        version: bible.version
      }
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

  return { loadBibleText, handleAddBibleToPresentation }
}
