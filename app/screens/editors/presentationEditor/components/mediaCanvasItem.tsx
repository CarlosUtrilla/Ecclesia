import { Media } from '@prisma/client'
import CanvasItemShell from './canvasItemShell'
import CanvasTransformHandles, { ResizeHandle } from './canvasTransformHandles'
import { CanvasItemStyle, PresentationSlideItem } from '../utils/slideUtils'
import { useMediaServer } from '@/contexts/MediaServerContext'

type Props = {
  item: PresentationSlideItem
  style: CanvasItemStyle
  mediaItem?: Media
  isSelected: boolean
  isRotating?: boolean
  highlightSnapTarget?: boolean
  onSelectItem: (itemId: string) => void
  onStartMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartRotate: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartResize: (event: React.PointerEvent<HTMLDivElement>, corner: ResizeHandle) => void
}

export default function MediaCanvasItem({
  item,
  style,
  mediaItem,
  isSelected,
  isRotating = false,
  highlightSnapTarget,
  onSelectItem,
  onStartMove,
  onStartRotate,
  onStartResize
}: Props) {
  const { buildMediaUrl } = useMediaServer()

  return (
    <CanvasItemShell
      itemId={item.id}
      style={style}
      layer={Number(item.layer || 0)}
      isSelected={isSelected}
      rotationLabel={isRotating ? `${Math.round(style.rotation)}°` : undefined}
      highlightSnapTarget={highlightSnapTarget}
      onSelect={(event) => {
        event.stopPropagation()
        onSelectItem(item.id)
      }}
      onPointerDown={onStartMove}
      handles={
        isSelected ? (
          <CanvasTransformHandles onStartRotate={onStartRotate} onStartResize={onStartResize} />
        ) : null
      }
    >
      <div className="w-full h-full rounded-[inherit] overflow-hidden">
        {mediaItem ? (
          mediaItem.type === 'VIDEO' ? (
            <video
              src={buildMediaUrl(mediaItem.filePath)}
              className="w-full h-full object-contain pointer-events-none"
              muted
              controls={false}
              preload="metadata"
            />
          ) : (
            <img
              src={buildMediaUrl(mediaItem.filePath)}
              alt={mediaItem.name}
              className="w-full h-full object-contain pointer-events-none"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Selecciona una imagen o video
          </div>
        )}
      </div>
    </CanvasItemShell>
  )
}
