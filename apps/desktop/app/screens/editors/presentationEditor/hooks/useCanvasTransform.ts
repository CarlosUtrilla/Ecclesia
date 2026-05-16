import { MutableRefObject, PointerEvent, useCallback, useEffect, useRef } from 'react'
import { ResizeHandle } from '../components/canvasTransformHandles'
import { CanvasItemStyle } from '../utils/slideUtils'

type DragMode = 'move' | 'resize' | 'rotate'

export type DragState = {
  pointerId: number
  itemId: string
  itemType?: 'TEXT' | 'BIBLE' | 'SONG' | 'MEDIA' | 'GROUP' | 'SHAPE'
  mode: DragMode
  resizeCorner?: ResizeHandle
  startX: number
  startY: number
  initialStyle: CanvasItemStyle
}

const isTextContentItemType = (itemType: DragState['itemType']) =>
  itemType === 'TEXT' || itemType === 'BIBLE' || itemType === 'SONG' || itemType === 'GROUP'

export const getTextResizeBehavior = (itemType: DragState['itemType'], shiftKey: boolean) => {
  const isTextItem = isTextContentItemType(itemType)

  if (isTextItem) {
    return {
      preserveAspectRatio: !shiftKey,
      scaleFontSizeWithResize: !shiftKey
    }
  }

  return {
    preserveAspectRatio: shiftKey,
    scaleFontSizeWithResize: false
  }
}

export const shouldScaleTextFontOnResize = (
  itemType: DragState['itemType'],
  shiftKey: boolean,
  resizeCorner: ResizeHandle
) => {
  if (!isTextContentItemType(itemType)) return false
  if (
    resizeCorner === 'left' ||
    resizeCorner === 'right' ||
    resizeCorner === 'top' ||
    resizeCorner === 'bottom'
  )
    return false

  const behavior = getTextResizeBehavior(itemType, shiftKey)
  return behavior.scaleFontSizeWithResize
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
      const resizeBehavior = getTextResizeBehavior(activeDrag.itemType, event.shiftKey)
      const scaleFontSizeWithResize = shouldScaleTextFontOnResize(
        activeDrag.itemType,
        event.shiftKey,
        corner
      )
      const preserveAspectRatio =
        corner === 'left' || corner === 'right' || corner === 'top' || corner === 'bottom'
          ? false
          : resizeBehavior.preserveAspectRatio
      const aspectRatio = Math.max(0.01, activeDrag.initialStyle.width / activeDrag.initialStyle.height)
      const initialLeft = activeDrag.initialStyle.x
      const initialTop = activeDrag.initialStyle.y
      const initialRight = activeDrag.initialStyle.x + activeDrag.initialStyle.width
      const initialBottom = activeDrag.initialStyle.y + activeDrag.initialStyle.height

      const getConstrainedSize = (width: number, height: number) => {
        if (!preserveAspectRatio) {
          return {
            width: Math.max(minWidth, Math.round(width)),
            height: Math.max(minHeight, Math.round(height))
          }
        }

        const safeWidth = Math.max(minWidth, width)
        const safeHeight = Math.max(minHeight, height)

        // Evaluar dos candidatos (driver por ancho o por alto) y escoger el que
        // mantiene el handle más cerca del puntero para evitar saltos bruscos.
        const widthDrivenWidth = Math.max(minWidth, Math.round(safeWidth))
        const widthDrivenHeight = Math.max(minHeight, Math.round(widthDrivenWidth / aspectRatio))

        const heightDrivenHeight = Math.max(minHeight, Math.round(safeHeight))
        const heightDrivenWidth = Math.max(minWidth, Math.round(heightDrivenHeight * aspectRatio))

        // Error respecto al tamaño "deseado" por el puntero en cada eje.
        // Menor error => menor sensación de salto del handle.
        const widthDrivenError = Math.abs(widthDrivenHeight - safeHeight)
        const heightDrivenError = Math.abs(heightDrivenWidth - safeWidth)

        if (widthDrivenError <= heightDrivenError) {
          return {
            width: widthDrivenWidth,
            height: widthDrivenHeight
          }
        }

        return {
          width: heightDrivenWidth,
          height: heightDrivenHeight
        }
      }

      const buildResizeUpdate = (
        nextX: number,
        nextY: number,
        nextWidth: number,
        nextHeight: number
      ) => {
        const next: Partial<CanvasItemStyle> = {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.max(minWidth, Math.round(nextWidth)),
          height: Math.max(minHeight, Math.round(nextHeight))
        }

        if (scaleFontSizeWithResize && activeDrag.initialStyle.fontSize > 0) {
          const nextWidth = next.width ?? activeDrag.initialStyle.width
          const scaleFactor = nextWidth / activeDrag.initialStyle.width
          next.fontSize = Math.max(8, Math.round(activeDrag.initialStyle.fontSize * scaleFactor))
        }

        return next
      }

      const getRawBoundsForHandle = () => {
        const movingLeft = corner.includes('left')
        const movingRight = corner.includes('right')
        const movingTop = corner.includes('top')
        const movingBottom = corner.includes('bottom')
        const horizontalOnly = corner === 'left' || corner === 'right'
        const verticalOnly = corner === 'top' || corner === 'bottom'

        const rawLeft = movingLeft ? initialLeft + deltaX : initialLeft
        const rawRight = movingRight ? initialRight + deltaX : initialRight
        const rawTop = movingTop ? initialTop + deltaY : initialTop
        const rawBottom = movingBottom ? initialBottom + deltaY : initialBottom

        return {
          movingLeft,
          movingRight,
          movingTop,
          movingBottom,
          horizontalOnly,
          verticalOnly,
          rawLeft,
          rawRight,
          rawTop,
          rawBottom
        }
      }

      if (preserveAspectRatio) {
        const {
          movingLeft,
          movingRight,
          movingTop,
          movingBottom,
          horizontalOnly,
          verticalOnly,
          rawLeft,
          rawRight,
          rawTop,
          rawBottom
        } = getRawBoundsForHandle()

        const anchorX = movingLeft ? initialRight : movingRight ? initialLeft : initialLeft + activeDrag.initialStyle.width / 2
        const anchorY = movingTop ? initialBottom : movingBottom ? initialTop : initialTop + activeDrag.initialStyle.height / 2

        const rawWidth = horizontalOnly
          ? Math.abs((movingLeft ? anchorX - rawLeft : rawRight - anchorX) * 2)
          : Math.abs((movingLeft ? anchorX - rawLeft : rawRight - anchorX))
        const rawHeight = verticalOnly
          ? Math.abs((movingTop ? anchorY - rawTop : rawBottom - anchorY) * 2)
          : Math.abs((movingTop ? anchorY - rawTop : rawBottom - anchorY))

        const constrained = getConstrainedSize(
          horizontalOnly ? rawWidth : rawWidth || activeDrag.initialStyle.width,
          verticalOnly ? rawHeight : rawHeight || activeDrag.initialStyle.height
        )

        let nextX = initialLeft
        let nextY = initialTop

        if (horizontalOnly) {
          nextX = Math.round(anchorX - constrained.width / 2)
          nextY = Math.round(anchorY - constrained.height / 2)
        } else if (verticalOnly) {
          nextX = Math.round(anchorX - constrained.width / 2)
          nextY = Math.round(anchorY - constrained.height / 2)
        } else {
          nextX = movingLeft ? Math.round(anchorX - constrained.width) : Math.round(anchorX)
          nextY = movingTop ? Math.round(anchorY - constrained.height) : Math.round(anchorY)
        }

        const rightEdge = nextX + constrained.width
        const bottomEdge = nextY + constrained.height
        const snappedLeft = getSnappedEdge(nextX, boundsWidth)
        const snappedRight = getSnappedEdge(rightEdge, boundsWidth)
        const snappedTop = getSnappedEdge(nextY, boundsHeight)
        const snappedBottom = getSnappedEdge(bottomEdge, boundsHeight)

        const guideX = movingLeft ? snappedLeft.guide : movingRight ? snappedRight.guide : null
        const guideY = movingTop ? snappedTop.guide : movingBottom ? snappedBottom.guide : null

        syncResizeGuides(guideX, guideY, nextX, nextY)
        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(nextX, nextY, constrained.width, constrained.height)
        )
        return
      }

      if (corner === 'right') {
        const proposedRight = initialRight + deltaX
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        syncResizeGuides(snappedRight.guide, null, initialLeft, initialTop)

        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(initialLeft, initialTop, snappedRight.value - initialLeft, activeDrag.initialStyle.height)
        )
        return
      }

      if (corner === 'left') {
        const proposedLeft = initialLeft + deltaX
        const snappedLeft = getSnappedEdge(proposedLeft, boundsWidth)
        const nextWidth = Math.max(minWidth, Math.round(initialRight - snappedLeft.value))
        const nextX = Math.round(initialRight - nextWidth)
        syncResizeGuides(snappedLeft.guide, null, nextX, initialTop)

        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(nextX, initialTop, nextWidth, activeDrag.initialStyle.height)
        )
        return
      }

      if (corner === 'bottom') {
        const proposedBottom = initialBottom + deltaY
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        syncResizeGuides(null, snappedBottom.guide, initialLeft, initialTop)

        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(initialLeft, initialTop, activeDrag.initialStyle.width, snappedBottom.value - initialTop)
        )
        return
      }

      if (corner === 'top') {
        const proposedTop = initialTop + deltaY
        const snappedTop = getSnappedEdge(proposedTop, boundsHeight)
        const nextHeight = Math.max(minHeight, Math.round(initialBottom - snappedTop.value))
        const nextY = Math.round(initialBottom - nextHeight)
        syncResizeGuides(null, snappedTop.guide, initialLeft, nextY)

        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(initialLeft, nextY, activeDrag.initialStyle.width, nextHeight)
        )
        return
      }

      if (corner === 'bottom-right') {
        const proposedRight = initialRight + deltaX
        const proposedBottom = initialBottom + deltaY
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        syncResizeGuides(snappedRight.guide, snappedBottom.guide, initialLeft, initialTop)

        scheduleStyleUpdate(
          activeDrag.itemId,
          buildResizeUpdate(initialLeft, initialTop, snappedRight.value - initialLeft, snappedBottom.value - initialTop)
        )
        return
      }

      if (corner === 'bottom-left') {
        const proposedLeft = initialLeft + deltaX
        const proposedBottom = initialBottom + deltaY
        const snappedLeft = getSnappedEdge(proposedLeft, boundsWidth)
        const snappedBottom = getSnappedEdge(proposedBottom, boundsHeight)
        const nextWidth = Math.max(minWidth, Math.round(initialRight - snappedLeft.value))
        const nextHeight = Math.max(minHeight, Math.round(snappedBottom.value - initialTop))
        const nextX = Math.round(initialRight - nextWidth)
        syncResizeGuides(snappedLeft.guide, snappedBottom.guide, nextX, initialTop)

        scheduleStyleUpdate(activeDrag.itemId, buildResizeUpdate(nextX, initialTop, nextWidth, nextHeight))
        return
      }

      if (corner === 'top-right') {
        const proposedTop = initialTop + deltaY
        const proposedRight = initialRight + deltaX
        const snappedTop = getSnappedEdge(proposedTop, boundsHeight)
        const snappedRight = getSnappedEdge(proposedRight, boundsWidth)
        const nextWidth = Math.max(minWidth, Math.round(snappedRight.value - initialLeft))
        const nextHeight = Math.max(minHeight, Math.round(initialBottom - snappedTop.value))
        const nextY = Math.round(initialBottom - nextHeight)
        syncResizeGuides(snappedRight.guide, snappedTop.guide, initialLeft, nextY)

        scheduleStyleUpdate(activeDrag.itemId, buildResizeUpdate(initialLeft, nextY, nextWidth, nextHeight))
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

      scheduleStyleUpdate(activeDrag.itemId, buildResizeUpdate(nextX, nextY, nextWidth, nextHeight))
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
