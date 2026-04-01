import { PresentationLayerItem, PresentationViewItems } from '@/ui/PresentationView/types'

export const getPresentationSlideKey = (slide: PresentationViewItems, fallbackIndex = 0) =>
  typeof slide.id === 'string' && slide.id.length > 0 ? slide.id : `slide-${fallbackIndex}`

type SlideStepRange = {
  start: number
  end: number
  mode: 'verse' | 'chunk'
  layerId?: string
}

export const getRangedBibleLayer = (
  slide?: PresentationViewItems
): PresentationLayerItem | null => {
  if (!slide || slide.resourceType !== 'PRESENTATION' || !Array.isArray(slide.presentationItems)) {
    return null
  }

  const rangedLayer = slide.presentationItems.find(
    (layer) =>
      layer.resourceType === 'BIBLE' &&
      layer.verse &&
      layer.verse.verseEnd !== undefined &&
      layer.verse.verseEnd > layer.verse.verse
  )

  return rangedLayer || null
}

export const getSlideVerseRange = (slide?: PresentationViewItems) => {
  const rangedLayer = getRangedBibleLayer(slide)
  if (rangedLayer?.verse) {
    return {
      start: rangedLayer.verse.verse,
      end: rangedLayer.verse.verseEnd as number,
      layerId: rangedLayer.id,
      mode: 'verse' as const
    }
  }

  if (!slide || slide.resourceType !== 'PRESENTATION') return null

  if (Array.isArray(slide.presentationItems)) {
    const chunkedLayer = slide.presentationItems.find(
      (layer) =>
        layer.resourceType === 'BIBLE' &&
        layer.verse &&
        Array.isArray(layer.chunkParts) &&
        layer.chunkParts.length > 1
    )

    if (chunkedLayer?.chunkParts) {
      return {
        start: 1,
        end: chunkedLayer.chunkParts.length,
        layerId: chunkedLayer.id,
        mode: 'chunk' as const
      }
    }
  }

  if (slide.verse && Array.isArray(slide.chunkParts) && slide.chunkParts.length > 1) {
    return {
      start: 1,
      end: slide.chunkParts.length,
      mode: 'chunk' as const
    }
  }

  return null
}

export const resolveSlideVerse = (
  slide: PresentationViewItems | undefined,
  fallbackIndex: number,
  verseBySlideKey?: Record<string, number>
) => {
  const range = getSlideVerseRange(slide)
  if (!range || !slide) return null

  const slideKey = getPresentationSlideKey(slide, fallbackIndex)
  const current = verseBySlideKey?.[slideKey]

  if (current === undefined) {
    return { ...range, current: range.start, slideKey }
  }

  const bounded = Math.max(range.start, Math.min(range.end, current))
  return { ...range, current: bounded, slideKey }
}
