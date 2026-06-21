import type { Media } from '@ecclesia/api'
import { useEffect, useRef } from 'react'
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
  onSelectItem: (itemId: string, options?: { toggle?: boolean }) => void
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
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || mediaItem?.type !== 'VIDEO') return
    const tryLoad = () => {
      el.load()
      el.currentTime = 0
    }
    const onLoadedData = () => {}
    el.addEventListener('loadeddata', onLoadedData)
    tryLoad()
    return () => {
      el.removeEventListener('loadeddata', onLoadedData)
    }
  }, [mediaItem?.filePath])

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
        onSelectItem(item.id, event.metaKey || event.ctrlKey ? { toggle: true } : undefined)
      }}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        const videoElement = target.closest('video') as HTMLVideoElement | null
        if (videoElement) {
          const videoRect = videoElement.getBoundingClientRect()
          const controlsZoneHeight = 44
          const isInControlsZone = event.clientY >= videoRect.bottom - controlsZoneHeight

          if (isInControlsZone) {
            return
          }
        }
        onStartMove(event)
      }}
      handles={
        isSelected ? (
          <CanvasTransformHandles onStartRotate={onStartRotate} onStartResize={onStartResize} />
        ) : null
      }
    >
      <div className="w-full h-full overflow-hidden" style={{ pointerEvents: 'auto' }}>
        {mediaItem ? (
          mediaItem.type === 'VIDEO' ? (
            <video
              ref={videoRef}
              src={buildMediaUrl(mediaItem.filePath)}
              className="w-full h-full object-contain"
              muted
              controls
              playsInline
              crossOrigin="anonymous"
              preload="auto"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const controlsZoneHeight = 40
                if (e.clientY >= rect.bottom - controlsZoneHeight) {
                  e.stopPropagation()
                }
              }}
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
