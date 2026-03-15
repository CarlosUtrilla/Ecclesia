import type { Media } from '@prisma/client'
import { PresentationLayerItem, PresentationViewItems } from '@/ui/PresentationView/types'
import { ThemeWithMedia } from 'database/controllers/themes/themes.dto'
import {
  PresentationSlide,
  PresentationSlideItem
} from 'database/controllers/presentations/presentations.dto'
import { getShapeTypeFromAccessData } from '@/screens/editors/presentationEditor/utils/slideUtils'

const BASE_CANVAS_WIDTH = 1280
const BASE_CANVAS_HEIGHT = 720
const EDGE_CLAMP_THRESHOLD = 2

const normalizeCanvasStyleToRelative = (customStyle?: string) => {
  if (!customStyle) return customStyle

  const declarations = customStyle
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)

  if (declarations.length === 0) return customStyle

  const styleMap = declarations.reduce<Record<string, string>>((acc, declaration) => {
    const [rawProperty, ...valueParts] = declaration.split(':')
    const property = rawProperty?.trim()
    const value = valueParts.join(':').trim()
    if (!property || !value) return acc
    acc[property] = value
    return acc
  }, {})

  const leftPx = Number((styleMap.left || '').replace('px', '').trim())
  const topPx = Number((styleMap.top || '').replace('px', '').trim())
  const widthPx = Number((styleMap.width || '').replace('px', '').trim())
  const heightPx = Number((styleMap.height || '').replace('px', '').trim())

  const normalizedLeftPx =
    Number.isFinite(leftPx) && Math.abs(leftPx) <= EDGE_CLAMP_THRESHOLD ? 0 : leftPx
  const normalizedTopPx =
    Number.isFinite(topPx) && Math.abs(topPx) <= EDGE_CLAMP_THRESHOLD ? 0 : topPx

  let normalizedWidthPx = widthPx
  let normalizedHeightPx = heightPx

  if (
    Number.isFinite(normalizedLeftPx) &&
    Number.isFinite(widthPx) &&
    Math.abs(BASE_CANVAS_WIDTH - (normalizedLeftPx + widthPx)) <= EDGE_CLAMP_THRESHOLD
  ) {
    normalizedWidthPx = BASE_CANVAS_WIDTH - normalizedLeftPx
  }

  if (
    Number.isFinite(normalizedTopPx) &&
    Number.isFinite(heightPx) &&
    Math.abs(BASE_CANVAS_HEIGHT - (normalizedTopPx + heightPx)) <= EDGE_CLAMP_THRESHOLD
  ) {
    normalizedHeightPx = BASE_CANVAS_HEIGHT - normalizedTopPx
  }

  const nextDeclarations = declarations.map((declaration) => {
    const [rawProperty, ...valueParts] = declaration.split(':')
    const property = rawProperty?.trim().toLowerCase()
    const value = valueParts.join(':').trim()

    if (!property || !value) return declaration

    if (property === 'left' && Number.isFinite(normalizedLeftPx)) {
      const relative = (normalizedLeftPx / BASE_CANVAS_WIDTH) * 100
      return `${property}: ${relative}%`
    }

    if (property === 'top' && Number.isFinite(normalizedTopPx)) {
      const relative = (normalizedTopPx / BASE_CANVAS_HEIGHT) * 100
      return `${property}: ${relative}%`
    }

    if (property === 'width' && Number.isFinite(normalizedWidthPx)) {
      const relative = (normalizedWidthPx / BASE_CANVAS_WIDTH) * 100
      return `${property}: ${relative}%`
    }

    if (property === 'height' && Number.isFinite(normalizedHeightPx)) {
      const relative = (normalizedHeightPx / BASE_CANVAS_HEIGHT) * 100
      return `${property}: ${relative}%`
    }

    return declaration
  })

  return nextDeclarations.join('; ')
}

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
  const [verseStartRaw, verseEndRaw] = (verseRangeRaw || '').split('-')

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
    verseEnd: verseEndRaw ? Number(verseEndRaw) : undefined,
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
      customStyle: normalizeCanvasStyleToRelative(item.customStyle),
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
            duration: media.duration,
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
    shapeType: item.type === 'SHAPE' ? getShapeTypeFromAccessData(item.accessData) : undefined,
    customStyle: normalizeCanvasStyleToRelative(item.customStyle),
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
  mediaById: Map<number, Media>,
  themeById?: Map<number, ThemeWithMedia>
): PresentationViewItems => {
  const slideTheme =
    slide.themeId !== undefined && slide.themeId !== null
      ? themeById?.get(Number(slide.themeId))
      : undefined

  if (Array.isArray(slide.items)) {
    const layeredItems = slide.items
      .map((item) => mapPresentationItemToLayer(item, mediaById))
      .sort((a, b) => Number(a.layer || 0) - Number(b.layer || 0))

    return {
      id: slide.id,
      text: '',
      videoLiveBehavior: slide.videoLiveBehavior,
      transitionSettings:
        typeof slide.transitionSettings === 'string'
          ? slide.transitionSettings
          : slide.transitionSettings
            ? JSON.stringify(slide.transitionSettings)
            : undefined,
      theme: slideTheme,
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
        videoLiveBehavior: slide.videoLiveBehavior,
        transitionSettings:
          typeof slide.transitionSettings === 'string'
            ? slide.transitionSettings
            : slide.transitionSettings
              ? JSON.stringify(slide.transitionSettings)
              : undefined,
        theme: slideTheme,
        customStyle: buildMediaStyle(slide),
        resourceType: 'MEDIA'
      }
    }
  }

  return {
    text: slide.text || '',
    videoLiveBehavior: slide.videoLiveBehavior,
    transitionSettings:
      typeof slide.transitionSettings === 'string'
        ? slide.transitionSettings
        : slide.transitionSettings
          ? JSON.stringify(slide.transitionSettings)
          : undefined,
    theme: slideTheme,
    customStyle: buildCustomStyle(slide),
    verse: slide.bible
      ? {
          bookId: slide.bible.bookId,
          chapter: slide.bible.chapter,
          verse: slide.bible.verseStart,
          verseEnd: slide.bible.verseEnd,
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
