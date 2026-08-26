import type { ContentScreen } from '@/contexts/ScheduleContext/types'
import type { ScheduleItem } from '@ecclesia/api'

/** Tipos de Media que no se proyectan como archivo, sino como diapositivas. */
const DOCUMENT_MEDIA_TYPES = new Set(['PDF', 'PPTX'])

type MediaLike = { id: number; type?: string | null }

/**
 * Un Media PDF/PPTX se envía a live como las diapositivas de su presentación vinculada,
 * así que en el panel se controla con el render de presentaciones, no con el de medios.
 *
 * Se resuelve preferentemente por `content.renderAs` (lo marca
 * `getScheduleItemContentScreen`): el array `media` del contexto solo trae los medios del
 * cronograma actual, así que al enviar un PPTX directo desde la biblioteca no está ahí.
 */
export function isPresentationLikeMedia(
  item: Pick<ScheduleItem, 'type' | 'accessData'> | null | undefined,
  content: Pick<ContentScreen, 'renderAs'> | null | undefined,
  media: MediaLike[] = [],
): boolean {
  if (item?.type !== 'MEDIA') return false
  if (content?.renderAs === 'presentation') return true

  const mediaItem = media.find((m) => m.id === Number(item.accessData))
  return mediaItem?.type ? DOCUMENT_MEDIA_TYPES.has(mediaItem.type) : false
}

export function isDocumentMediaType(type?: string | null): boolean {
  return !!type && DOCUMENT_MEDIA_TYPES.has(type)
}
