import { getPresentationSlideKey } from '@/lib/presentationVerseController'
import { PresentationViewItems } from '@/ui/PresentationView/types'

const DIRECT_SLIDE_OVERRIDE_KEY = '__slide__'

export type PresentationBibleOverride = {
  text: string
  version: string
}

export type PresentationBibleOverrideMap = Record<string, PresentationBibleOverride>

export type PresentationBibleTarget = {
  overrideKey: string
  version: string
  bookId: number
  chapter: number
  verseStart: number
  verseEnd: number
}

export const buildPresentationBibleOverrideKey = (slideKey: string, layerId?: string) =>
  `${slideKey}::${layerId || DIRECT_SLIDE_OVERRIDE_KEY}`

export const getPresentationBibleTargets = (
  slide: PresentationViewItems | undefined,
  slideIndex: number
): PresentationBibleTarget[] => {
  if (!slide) return []

  const slideKey = getPresentationSlideKey(slide, slideIndex)

  if (slide.resourceType === 'BIBLE' && slide.verse) {
    return [
      {
        overrideKey: buildPresentationBibleOverrideKey(slideKey),
        version: slide.verse.version,
        bookId: slide.verse.bookId,
        chapter: slide.verse.chapter,
        verseStart: slide.verse.verse,
        verseEnd: slide.verse.verseEnd ?? slide.verse.verse
      }
    ]
  }

  if (slide.resourceType !== 'PRESENTATION' || !Array.isArray(slide.presentationItems)) {
    return []
  }

  return slide.presentationItems.flatMap((layer) => {
    if (layer.resourceType !== 'BIBLE' || !layer.verse) {
      return []
    }

    return [
      {
        overrideKey: buildPresentationBibleOverrideKey(slideKey, layer.id),
        version: layer.verse.version,
        bookId: layer.verse.bookId,
        chapter: layer.verse.chapter,
        verseStart: layer.verse.verse,
        verseEnd: layer.verse.verseEnd ?? layer.verse.verse
      }
    ]
  })
}

export const getPresentationBibleVersion = (
  slide: PresentationViewItems | undefined,
  slideIndex: number
) => getPresentationBibleTargets(slide, slideIndex)[0]?.version || ''

export const applyPresentationBibleOverrides = (
  slides: PresentationViewItems[],
  overrides?: PresentationBibleOverrideMap
) => {
  if (!overrides || Object.keys(overrides).length === 0) {
    return slides
  }

  return slides.map((slide, slideIndex) => {
    const slideKey = getPresentationSlideKey(slide, slideIndex)

    if (slide.resourceType === 'BIBLE' && slide.verse) {
      const override = overrides[buildPresentationBibleOverrideKey(slideKey)]
      if (!override) return slide

      return {
        ...slide,
        text: override.text,
        verse: {
          ...slide.verse,
          version: override.version
        }
      }
    }

    if (slide.resourceType !== 'PRESENTATION' || !Array.isArray(slide.presentationItems)) {
      return slide
    }

    let hasChanges = false
    const nextPresentationItems = slide.presentationItems.map((layer) => {
      if (layer.resourceType !== 'BIBLE' || !layer.verse) {
        return layer
      }

      const override = overrides[buildPresentationBibleOverrideKey(slideKey, layer.id)]
      if (!override) {
        return layer
      }

      hasChanges = true

      return {
        ...layer,
        text: override.text,
        verse: {
          ...layer.verse,
          version: override.version
        }
      }
    })

    if (!hasChanges) {
      return slide
    }

    return {
      ...slide,
      presentationItems: nextPresentationItems
    }
  })
}