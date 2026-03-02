import { Media } from '@prisma/client'
import { PresentationLayerItem, PresentationViewItems } from '@/ui/PresentationView/types'
import {
  PresentationSlide,
  PresentationSlideItem
} from 'database/controllers/presentations/presentations.dto'

const buildCustomStyle = (slide: PresentationSlide) => {
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

const buildMediaStyle = (slide: PresentationSlide) => {
  if (!slide.textStyle) return ''

  return JSON.stringify({
    offsetX: Number(slide.textStyle.offsetX || 0),
    offsetY: Number(slide.textStyle.offsetY || 0),
    mediaWidth: Number(slide.textStyle.mediaWidth || 70),
    mediaHeight: Number(slide.textStyle.mediaHeight || 70)
  })
}

const parseBibleAccessData = (accessData?: string) => {
  if (!accessData) return undefined
  const [bookRaw, chapterRaw, verseRangeRaw, versionRaw] = accessData.split(',')
  const [verseStartRaw] = (verseRangeRaw || '').split('-')

  const bookId = Number(bookRaw)
  const chapter = Number(chapterRaw)
  const verse = Number(verseStartRaw)

  if (!Number.isFinite(bookId) || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return undefined
  }

  return {
    bookId,
    chapter,
    verse,
    version: versionRaw || 'RVR1960'
  }
}

const mapPresentationItemToLayer = (
  item: PresentationSlideItem,
  mediaById: Map<number, Media>
): PresentationLayerItem => {
  if (item.type === 'MEDIA') {
    const mediaId = Number(item.accessData || 0)
    const media = mediaById.get(mediaId)

    return {
      id: item.id,
      text: '',
      customStyle: item.customStyle,
      animationSettings:
        typeof item.animationSettings === 'string'
          ? item.animationSettings
          : item.animationSettings
            ? JSON.stringify(item.animationSettings)
            : undefined,
      layer: item.layer,
      media: media
        ? {
            id: media.id,
            name: media.name,
            type: media.type,
            filePath: media.filePath,
            thumbnail: media.thumbnail,
            format: media.format
          }
        : undefined,
      resourceType: 'MEDIA'
    }
  }

  return {
    id: item.id,
    text: item.text || '',
    customStyle: item.customStyle,
    animationSettings:
      typeof item.animationSettings === 'string'
        ? item.animationSettings
        : item.animationSettings
          ? JSON.stringify(item.animationSettings)
          : undefined,
    layer: item.layer,
    verse: item.type === 'BIBLE' ? parseBibleAccessData(item.accessData) : undefined,
    resourceType:
      item.type === 'TEXT' ? 'TEXT' : (item.type as PresentationLayerItem['resourceType'])
  }
}

export const presentationSlideToViewItem = (
  slide: PresentationSlide,
  mediaById: Map<number, Media>
): PresentationViewItems => {
  if (Array.isArray(slide.items)) {
    const layeredItems = slide.items
      .map((item) => mapPresentationItemToLayer(item, mediaById))
      .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))

    return {
      id: slide.id,
      text: '',
      resourceType: 'PRESENTATION',
      presentationItems: layeredItems
    }
  }

  if (slide.type === 'MEDIA' && slide.mediaId) {
    const media = mediaById.get(slide.mediaId)

    if (media) {
      return {
        ...(media as unknown as PresentationViewItems),
        text: '',
        customStyle: buildMediaStyle(slide),
        resourceType: 'MEDIA'
      }
    }
  }

  return {
    text: slide.text || '',
    customStyle: buildCustomStyle(slide),
    verse: slide.bible
      ? {
          bookId: slide.bible.bookId,
          chapter: slide.bible.chapter,
          verse: slide.bible.verseStart,
          version: slide.bible.version
        }
      : undefined,
    resourceType: 'PRESENTATION'
  }
}

export const getSlideLabel = (slide: PresentationSlide) => {
  if (Array.isArray(slide.items)) {
    return `${slide.items.length} item${slide.items.length === 1 ? '' : 's'}`
  }

  if (slide.type === 'TEXT') return 'Texto'
  if (slide.type === 'MEDIA') return 'Media'
  if (slide.bible) {
    const { bookId, chapter, verseStart, verseEnd } = slide.bible
    return `Biblia ${bookId}:${chapter}:${verseStart}${verseEnd ? `-${verseEnd}` : ''}`
  }
  return 'Biblia'
}
