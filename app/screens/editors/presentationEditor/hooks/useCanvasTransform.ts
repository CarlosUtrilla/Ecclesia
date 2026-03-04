import { MutableRefObject, PointerEvent, useCallback, useEffect, useRef } from 'react'
import { ResizeHandle } from '../components/canvasTransformHandles'
import { CanvasItemStyle } from '../utils/slideUtils'

type DragMode = 'move' | 'resize' | 'rotate'

export type DragState = {
  pointerId: number
  itemId: string
  mode: DragMode
  resizeCorner?: ResizeHandle
  startX: number
  startY: number
  initialStyle: CanvasItemStyle
}

type Params = {
  dragRef: MutableRefObject<DragState | null>
  onItemStyleChange: (itemId: string, next: Partial<CanvasItemStyle>) => void
  clearSnapGuides: () => void
  syncSnapGuides: (snappedPosition: {
    x: number
    y: number
    guideX: number | null
    guideY: number | null
    guideXSource: 'slide' | 'item' | null
    guideYSource: 'slide' | 'item' | null
    guideXTargetItemId?: string
    guideYTargetItemId?: string
  }) => void
  getPointerPositionInCanvas: (event: PointerEvent<HTMLDivElement>) => { x: number; y: number }
  getSnappedMovePosition: (
    itemId: string,
    proposedX: number,
    proposedY: number,
    width: number,
    height: number
  ) => {
    x: number
    y: number
    guideX: number | null
    guideY: number | null
    guideXSource: 'slide' | 'item' | null
    guideYSource: 'slide' | 'item' | null
    guideXTargetItemId?: string
    guideYTargetItemId?: string
  }
}

export default function useCanvasTransform({
  dragRef,
  onItemStyleChange,
  clearSnapGuides,
  syncSnapGuides,
  getPointerPositionInCanvas,
  getSnappedMovePosition
}: Params) {
  const pendingStyleUpdateRef = useRef<{ itemId: string; next: Partial<CanvasItemStyle> } | null>(
    null
  )
  const frameRef = useRef<number | null>(null)

  const flushPendingTransform = useCallback(() => {
    const pendingUpdate = pendingStyleUpdateRef.current
    if (!pendingUpdate) return

    pendingStyleUpdateRef.current = null
    onItemStyleChange(pendingUpdate.itemId, pendingUpdate.next)
  }, [onItemStyleChange])

  const scheduleStyleUpdate = useCallback(
    (itemId: string, next: Partial<CanvasItemStyle>) => {
      pendingStyleUpdateRef.current = { itemId, next }

      if (frameRef.current !== null) return

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        flushPendingTransform()
      })
    },
    [flushPendingTransform]
  )

  const cancelPendingTransform = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pendingStyleUpdateRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cancelPendingTransform()
    }
  }, [cancelPendingTransform])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - activeDrag.startX
    const deltaY = event.clientY - activeDrag.startY

    if (activeDrag.mode === 'move') {
      const proposedX = activeDrag.initialStyle.x + deltaX
      const proposedY = activeDrag.initialStyle.y + deltaY

      if (event.altKey) {
        clearSnapGuides()
        scheduleStyleUpdate(activeDrag.itemId, {
          x: Math.round(proposedX),
          y: Math.round(proposedY)
        })
        return
      }

      const snappedPosition = getSnappedMovePosition(
        activeDrag.itemId,
        proposedX,
        proposedY,
        activeDrag.initialStyle.width,
        activeDrag.initialStyle.height
      )
      syncSnapGuides(snappedPosition)

      scheduleStyleUpdate(activeDrag.itemId, {
        x: snappedPosition.x,
        y: snappedPosition.y
      })
      return
    }

    if (activeDrag.mode === 'resize') {
      clearSnapGuides()

      const corner = activeDrag.resizeCorner || 'bottom-right'
      const minWidth = 80
      const minHeight = 60

      if (corner === 'right') {
        scheduleStyleUpdate(activeDrag.itemId, {
          width: Math.max(minWidth, Math.round(activeDrag.initialStyle.width + deltaX))
        })
        return
      }

      if (corner === 'left') {
        const nextWidth = Math.max(minWidth, Math.round(activeDrag.initialStyle.width - deltaX))
        const nextX = Math.round(
          activeDrag.initialStyle.x + (activeDrag.initialStyle.width - nextWidth)
        )

        scheduleStyleUpdate(activeDrag.itemId, {
          x: nextX,
          width: nextWidth
        })
        return
      }

      if (corner === 'bottom') {
        scheduleStyleUpdate(activeDrag.itemId, {
          height: Math.max(minHeight, Math.round(activeDrag.initialStyle.height + deltaY))
        })
        return
      }

      if (corner === 'top') {
        const nextHeight = Math.max(minHeight, Math.round(activeDrag.initialStyle.height - deltaY))
        const nextY = Math.round(
          activeDrag.initialStyle.y + (activeDrag.initialStyle.height - nextHeight)
        )

        scheduleStyleUpdate(activeDrag.itemId, {
          y: nextY,
          height: nextHeight
        })
        return
      }

      if (corner === 'bottom-right') {
        scheduleStyleUpdate(activeDrag.itemId, {
          width: Math.max(minWidth, Math.round(activeDrag.initialStyle.width + deltaX)),
          height: Math.max(minHeight, Math.round(activeDrag.initialStyle.height + deltaY))
        })
        return
      }

      if (corner === 'bottom-left') {
        const nextWidth = Math.max(minWidth, Math.round(activeDrag.initialStyle.width - deltaX))
        const nextX = Math.round(
          activeDrag.initialStyle.x + (activeDrag.initialStyle.width - nextWidth)
        )

        scheduleStyleUpdate(activeDrag.itemId, {
          x: nextX,
          width: nextWidth,
          height: Math.max(minHeight, Math.round(activeDrag.initialStyle.height + deltaY))
        })
        return
      }

      if (corner === 'top-right') {
        const nextHeight = Math.max(minHeight, Math.round(activeDrag.initialStyle.height - deltaY))
        const nextY = Math.round(
          activeDrag.initialStyle.y + (activeDrag.initialStyle.height - nextHeight)
        )

        scheduleStyleUpdate(activeDrag.itemId, {
          y: nextY,
          width: Math.max(minWidth, Math.round(activeDrag.initialStyle.width + deltaX)),
          height: nextHeight
        })
        return
      }

      const nextWidth = Math.max(minWidth, Math.round(activeDrag.initialStyle.width - deltaX))
      const nextHeight = Math.max(minHeight, Math.round(activeDrag.initialStyle.height - deltaY))
      const nextX = Math.round(
        activeDrag.initialStyle.x + (activeDrag.initialStyle.width - nextWidth)
      )
      const nextY = Math.round(
        activeDrag.initialStyle.y + (activeDrag.initialStyle.height - nextHeight)
      )

      scheduleStyleUpdate(activeDrag.itemId, {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight
      })
      return
    }

    const centerX = activeDrag.initialStyle.x + activeDrag.initialStyle.width / 2
    const centerY = activeDrag.initialStyle.y + activeDrag.initialStyle.height / 2
    clearSnapGuides()
    const pointer = getPointerPositionInCanvas(event)
    const angle = (Math.atan2(pointer.y - centerY, pointer.x - centerX) * 180) / Math.PI

    scheduleStyleUpdate(activeDrag.itemId, {
      rotation: Math.round(angle + 90)
    })
  }

  return {
    handlePointerMove,
    flushPendingTransform,
    cancelPendingTransform
  }
}
