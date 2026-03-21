import { generateUniqueId } from '@/lib/utils'
import {
  buildCanvasItemStyle,
  getNextLayer,
  parseCanvasItemStyle,
  PresentationSlideItem
} from './slideUtils'

export type PastedImagePayload = {
  file: File
  bytes: number[]
  mimeType: string
}

export function getPastedImageFile(
  event: Pick<ClipboardEvent, 'clipboardData'>
): File | null {
  const files = event.clipboardData?.files
  if (!files || files.length === 0) return null

  for (const file of Array.from(files)) {
    if (typeof file.type === 'string' && file.type.startsWith('image/')) {
      return file
    }
  }

  return null
}

export async function getPastedImagePayload(
  event: Pick<ClipboardEvent, 'clipboardData'>
): Promise<PastedImagePayload | null> {
  const imageFile = getPastedImageFile(event)
  if (!imageFile) return null

  const mimeType = imageFile.type || 'image/png'
  if (!mimeType.startsWith('image/')) return null

  const arrayBuffer = await imageFile.arrayBuffer()
  const bytes = Array.from(new Uint8Array(arrayBuffer))

  return {
    file: imageFile,
    bytes,
    mimeType
  }
}

type CloneClipboardItemsParams = {
  copiedItems: PresentationSlideItem[]
  existingItems: PresentationSlideItem[]
  offset?: number
  idGenerator?: () => string
}

export function cloneClipboardItems({
  copiedItems,
  existingItems,
  offset = 24,
  idGenerator = generateUniqueId
}: CloneClipboardItemsParams): PresentationSlideItem[] {
  if (copiedItems.length === 0) return []

  const nextLayerBase = getNextLayer(existingItems)

  return copiedItems.map((copiedItem, index) => {
    const copiedStyle = parseCanvasItemStyle(copiedItem.customStyle, copiedItem.type)

    return {
      ...copiedItem,
      id: idGenerator(),
      layer: nextLayerBase + index,
      customStyle: buildCanvasItemStyle(
        {
          ...copiedStyle,
          x: copiedStyle.x + offset,
          y: copiedStyle.y + offset
        },
        copiedItem.type
      )
    }
  })
}
