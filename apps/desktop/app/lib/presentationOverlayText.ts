import { PresentationViewItems } from '@/ui/PresentationView/types'
import { resolveSlideVerse } from './presentationVerseController'
import { getPresentationBibleTargets } from './presentationBibleVersionOverrides'
import { buildPresentationBibleBadgeLabel } from './presentationBibleBadge'

// Extrae el texto plano de lo que se está proyectando en un slide, para exponerlo
// como subtítulos en OBS. Omite medios (imagen/vídeo) y respeta el chunk activo de
// versículos bíblicos, replicando la resolución de texto de PresentationRender.

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'"
}

/** Convierte HTML (TipTap) a texto plano preservando saltos de párrafo/línea. */
export function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return ''
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const decoded = withBreaks.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity)
  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim()
}

/** Texto plano del layer/slide bíblico según el chunk activo (1-indexed). */
function resolveBibleText(
  slide: Pick<PresentationViewItems, 'chunks' | 'text'>,
  currentChunk: number
): string {
  const chunkContent = slide.chunks?.[currentChunk - 1]?.content
  return htmlToPlainText(chunkContent ?? slide.text)
}

/**
 * Devuelve el texto plano actualmente visible del slide, o '' si es medio puro.
 * @param slide slide activo
 * @param slideIndex índice del slide en la lista (para la key del chunk)
 * @param presentationVerseBySlideKey mapa slideKey → chunk actual (1-indexed)
 */
export function extractOverlayText(
  slide: PresentationViewItems | undefined,
  slideIndex: number,
  presentationVerseBySlideKey?: Record<string, number>
): string {
  if (!slide) return ''

  const controller = resolveSlideVerse(slide, slideIndex, presentationVerseBySlideKey)
  const currentChunk = controller?.current ?? 1

  // Medio puro (imagen/vídeo) → sin texto
  if (slide.resourceType === 'MEDIA') return ''

  // Presentación con capas: concatenar texto de capas de texto/biblia, omitir medios
  if (Array.isArray(slide.presentationItems) && slide.presentationItems.length > 0) {
    const parts: string[] = []
    for (const layer of slide.presentationItems) {
      if (layer.resourceType === 'MEDIA') continue
      const text =
        layer.resourceType === 'BIBLE'
          ? resolveBibleText(layer, currentChunk)
          : htmlToPlainText(layer.text)
      if (text) parts.push(text)
    }
    return parts.join('\n').trim()
  }

  // Slide bíblico directo
  if (slide.verse) return resolveBibleText(slide, currentChunk)

  // Slide de texto plano (canción, texto libre, presentación de texto)
  return htmlToPlainText(slide.text)
}

/** Número de versículo del chunk activo (o undefined si no aplica). */
function getActiveChunkVerse(
  slide: PresentationViewItems,
  currentChunk: number
): number | undefined {
  if (slide.resourceType === 'BIBLE' && slide.chunks) {
    return slide.chunks[currentChunk - 1]?.verse
  }
  if (Array.isArray(slide.presentationItems)) {
    const bibleLayer = slide.presentationItems.find(
      (layer) => layer.resourceType === 'BIBLE' && layer.chunks
    )
    return bibleLayer?.chunks?.[currentChunk - 1]?.verse
  }
  return undefined
}

/**
 * Referencia bíblica del slide activo (ej. "Juan 3:16"), o '' si no es bíblico.
 * @param resolveBookShortName resuelve el nombre corto del libro desde su id
 *   (normalmente `(id) => resolvePresentationBookShortName(id, bibleSchema)`)
 */
export function extractOverlayReference(
  slide: PresentationViewItems | undefined,
  slideIndex: number,
  presentationVerseBySlideKey: Record<string, number> | undefined,
  resolveBookShortName: (bookId: number) => string
): string {
  if (!slide) return ''

  const target = getPresentationBibleTargets(slide, slideIndex)[0]
  if (!target) return ''

  const controller = resolveSlideVerse(slide, slideIndex, presentationVerseBySlideKey)
  const currentChunk = controller?.current ?? 1

  return buildPresentationBibleBadgeLabel({
    bookShortName: resolveBookShortName(target.bookId),
    chapter: target.chapter,
    rangeStart: target.verseStart,
    rangeEnd: target.verseEnd,
    currentVerse: getActiveChunkVerse(slide, currentChunk)
  })
}
