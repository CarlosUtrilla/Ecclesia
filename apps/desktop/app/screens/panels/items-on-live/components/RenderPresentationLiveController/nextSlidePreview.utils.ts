import { PresentationViewItems } from '@/ui/PresentationView/types'

const PREVIEW_MAX_CHARS = 180

export function stripHtmlForPreview(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function trimPreviewText(text: string, maxChars = PREVIEW_MAX_CHARS): string {
  const normalized = stripHtmlForPreview(text)
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars).trimEnd()}...`
}

export function buildNextSlideFallbackPreview(slide: PresentationViewItems | undefined): string {
  if (!slide) return 'No hay siguiente diapositiva'

  if (slide.resourceType === 'BIBLE' || slide.resourceType === 'TEXT' || slide.resourceType === 'SONG') {
    const text = trimPreviewText(slide.text)
    return text || 'Sin texto disponible'
  }

  if (slide.resourceType === 'PRESENTATION' && Array.isArray(slide.presentationItems)) {
    const textLayers = slide.presentationItems
      .map((layer) => trimPreviewText(layer.text || ''))
      .filter(Boolean)

    if (textLayers.length > 0) {
      return trimPreviewText(textLayers.join(' | '))
    }
  }

  if (slide.resourceType === 'MEDIA') {
    const mediaType = slide.media?.type || (slide as { type?: string }).type || 'MEDIA'
    return `Siguiente recurso: ${mediaType}`
  }

  return 'Sin texto disponible'
}
