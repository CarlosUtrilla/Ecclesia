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
  canvasScale?: number
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
  canvasScale = 1,
  onItemStyleChange,
  clearSnapGuides,
  syncSnapGuides,
  getPointerPositionInCanvas,
  getSnappedMovePosition
}: Params) {
  const resizeSnapThreshold = 12

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

    const safeScale = Number.isFinite(canvasScale) && canvasScale > 0 ? canvasScale : 1
    const deltaX = (event.clientX - activeDrag.startX) / safeScale
    const deltaY = (event.clientY - activeDrag.startY) / safeScale

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
      const boundsWidth = event.currentTarget.clientWidth
      const boundsHeight = event.currentTarget.clientHeight
      const resizeThreshold = resizeSnapThreshold / safeScale

      const getSnappedEdge = (value: number, max: number) => {
        if (event.altKey) {
          return { value, guide: null as number | null }
        }

        if (Math.abs(value) <= resizeThreshold) {
          return { value: 0, guide: 0 }
        }

        if (Math.abs(max - value) <= resizeThreshold) {
          return { value: max, guide: max }
        }

        return { value, guide: null as number | null }
      }

      const syncResizeGuides = (
        guideX: number | null,
        guideY: number | null,
        nextX: number,
        nextY: number
      ) => {
        if (guideX === null && guideY === null) {
          clearSnapGuides()
          return
        }

        syncSnapGuides({
          x: Math.round(nextX),
          y: Math.round(nextY),
          guideX,
          guideY,
          guideXSource: guideX !== null ? 'slide' : null,
          guideYSource: guideY !== null ? 'slide' : null,
          guideXTargetItemId: undefined,
          guideYTargetItemId: undefined
        })
      }

      const corner = activeDrag.resizeCorner || 'bottom-right'
      const minWidth = 80
      const minHeight = 60
      const initialLeft = activeDrag.initialStyle.x
      const initialTop = activeDrag.initialStyle.y
      const initialRight = activeDrag.initialStyle.x + activeDrag.initialStyle.width
      const initialBottom = activeDrag.initialStyle.y + activeDrag.initialStyle.height

      if (corner === 'right') {
        const proposedRight = initialRight + deltaX
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        const nextWidth = Math.max(minWidth, Math.round(snappedRight.value - initialLeft))
        syncResizeGuides(snappedRight.guide, null, initialLeft, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, {
          width: nextWidth
        })
        return
      }

      if (corner === 'left') {
        const proposedLeft = initialLeft + deltaX
        const snappedLeft = getSnappedEdge(proposedLeft, boundsWidth)
        const nextWidth = Math.max(minWidth, Math.round(initialRight - snappedLeft.value))
        const nextX = Math.round(initialRight - nextWidth)
        syncResizeGuides(snappedLeft.guide, null, nextX, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, {
          x: nextX,
          width: nextWidth
        })
        return
      }

      if (corner === 'bottom') {
        const proposedBottom = initialBottom + deltaY
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        const nextHeight = Math.max(minHeight, Math.round(snappedBottom.value - initialTop))
        syncResizeGuides(null, snappedBottom.guide, initialLeft, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, {
          height: nextHeight
        })
        return
      }

      if (corner === 'top') {
        const proposedTop = initialTop + deltaY
        const snappedTop = getSnappedEdge(proposedTop, boundsHeight)
        const nextHeight = Math.max(minHeight, Math.round(initialBottom - snappedTop.value))
        const nextY = Math.round(initialBottom - nextHeight)
        syncResizeGuides(null, snappedTop.guide, initialLeft, nextY)

        scheduleStyleUpdate(activeDrag.itemId, {
          y: nextY,
          height: nextHeight
        })
        return
      }

      if (corner === 'bottom-right') {
        const proposedRight = initialRight + deltaX
        const proposedBottom = initialBottom + deltaY
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        const nextWidth = Math.max(minWidth, Math.round(snappedRight.value - initialLeft))
        const nextHeight = Math.max(minHeight, Math.round(snappedBottom.value - initialTop))
        syncResizeGuides(snappedRight.guide, snappedBottom.guide, initialLeft, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, {
          width: nextWidth,
          height: nextHeight
        })
        return
      }

      if (corner === 'bottom-left') {
        const proposedLeft = initialLeft + deltaX
        const proposedBottom = initialBottom + deltaY
        const snappedLeft = getSnappedEdge(proposedLeft, boundsWidth)
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        const nextWidth = Math.max(minWidth, Math.round(initialRight - snappedLeft.value))
        const nextX = Math.round(initialRight - nextWidth)
        const nextHeight = Math.max(minHeight, Math.round(snappedBottom.value - initialTop))
        syncResizeGuides(snappedLeft.guide, snappedBottom.guide, nextX, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, {
          x: nextX,
          width: nextWidth,
          height: nextHeight
        })
        return
      }

      if (corner === 'top-right') {
        const proposedTop = initialTop + deltaY
        const proposedRight = initialRight + deltaX
        const snappedTop = getSnappedEdge(proposedTop, boundsHeight)
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        const nextHeight = Math.max(minHeight, Math.round(initialBottom - snappedTop.value))
        const nextY = Math.round(initialBottom - nextHeight)
        const nextWidth = Math.max(minWidth, Math.round(snappedRight.value - initialLeft))
        syncResizeGuides(snappedRight.guide, snappedTop.guide, initialLeft, nextY)

        scheduleStyleUpdate(activeDrag.itemId, {
          y: nextY,
          width: nextWidth,
          height: nextHeight
        })
        return
      }

      const proposedLeft = initialLeft + deltaX
      const proposedTop = initialTop + deltaY
      const snappedLeft = getSnappedEdge(proposedLeft, boundsWidth)
      const snappedTop = getSnappedEdge(proposedTop, boundsHeight)
      const nextWidth = Math.max(minWidth, Math.round(initialRight - snappedLeft.value))
      const nextHeight = Math.max(minHeight, Math.round(initialBottom - snappedTop.value))
      const nextX = Math.round(initialRight - nextWidth)
      const nextY = Math.round(initialBottom - nextHeight)
      syncResizeGuides(snappedLeft.guide, snappedTop.guide, nextX, nextY)

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
    const rawRotation = angle + 90
    const snappedRotation = event.shiftKey ? Math.round(rawRotation / 45) * 45 : rawRotation

    scheduleStyleUpdate(activeDrag.itemId, {
      rotation: Math.round(snappedRotation)
    })
  }

  return {
    handlePointerMove,
    flushPendingTransform,
    cancelPendingTransform
  }
}
