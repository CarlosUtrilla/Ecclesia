import { useState } from 'react'
import { PointerEvent, RefObject } from 'react'
import { CanvasItemStyle, PresentationSlideItem } from '../utils/slideUtils'

export type SnapGuides = {
  x: number | null
  y: number | null
  xSource: 'slide' | 'item' | null
  ySource: 'slide' | 'item' | null
  xTargetItemId?: string
  yTargetItemId?: string
}

type SnapTargetMatch = {
  target: number
  diff: number
  source: 'slide' | 'item'
  itemId?: string
  delta: number
}

type AxisTarget = {
  position: number
  source: 'slide' | 'item'
  itemId?: string
}

type ParsedItem = {
  item: PresentationSlideItem
  style: CanvasItemStyle
}

type SnappedMovePosition = {
  x: number
  y: number
  guideX: number | null
  guideY: number | null
  guideXSource: 'slide' | 'item' | null
  guideYSource: 'slide' | 'item' | null
  guideXTargetItemId?: string
  guideYTargetItemId?: string
}

export type ComputeSnappedMovePositionParams = {
  itemId: string
  proposedX: number
  proposedY: number
  width: number
  height: number
  baseWidth: number
  baseHeight: number
  parsedItems: ParsedItem[]
  snapThreshold: number
}

export const computeSnappedMovePosition = ({
  itemId,
  proposedX,
  proposedY,
  width,
  height,
  baseWidth,
  baseHeight,
  parsedItems,
  snapThreshold
}: ComputeSnappedMovePositionParams): SnappedMovePosition => {
  const movingAnchorsX = [{ offset: 0 }, { offset: width / 2 }, { offset: width }]
  const movingAnchorsY = [{ offset: 0 }, { offset: height / 2 }, { offset: height }]

  const targetAnchorsX: AxisTarget[] = [
    { position: 0, source: 'slide' },
    { position: baseWidth / 2, source: 'slide' },
    { position: baseWidth, source: 'slide' }
  ]
  const targetAnchorsY: AxisTarget[] = [
    { position: 0, source: 'slide' },
    { position: baseHeight / 2, source: 'slide' },
    { position: baseHeight, source: 'slide' }
  ]

  for (const parsedItem of parsedItems) {
    const otherItem = parsedItem.item
    if (otherItem.id === itemId) continue
    const otherStyle = parsedItem.style

    targetAnchorsX.push(
      { position: otherStyle.x, source: 'item', itemId: otherItem.id },
      { position: otherStyle.x + otherStyle.width / 2, source: 'item', itemId: otherItem.id },
      { position: otherStyle.x + otherStyle.width, source: 'item', itemId: otherItem.id }
    )

    targetAnchorsY.push(
      { position: otherStyle.y, source: 'item', itemId: otherItem.id },
      {
        position: otherStyle.y + otherStyle.height / 2,
        source: 'item',
        itemId: otherItem.id
      },
      { position: otherStyle.y + otherStyle.height, source: 'item', itemId: otherItem.id }
    )
  }

  const nearestX = targetAnchorsX.reduce<SnapTargetMatch | null>((acc, targetAnchor) => {
    let bestForTarget: SnapTargetMatch | null = null

    for (const movingAnchor of movingAnchorsX) {
      const movingPosition = proposedX + movingAnchor.offset
      const delta = targetAnchor.position - movingPosition
      const diff = Math.abs(delta)

      if (diff > snapThreshold) continue

      if (!bestForTarget || diff < bestForTarget.diff) {
        bestForTarget = {
          target: targetAnchor.position,
          diff,
          source: targetAnchor.source,
          itemId: targetAnchor.itemId,
          delta
        }
      }
    }

    if (!bestForTarget) return acc
    if (!acc || bestForTarget.diff < acc.diff) return bestForTarget
    return acc
  }, null)

  const nearestY = targetAnchorsY.reduce<SnapTargetMatch | null>((acc, targetAnchor) => {
    let bestForTarget: SnapTargetMatch | null = null

    for (const movingAnchor of movingAnchorsY) {
      const movingPosition = proposedY + movingAnchor.offset
      const delta = targetAnchor.position - movingPosition
      const diff = Math.abs(delta)

      if (diff > snapThreshold) continue

      if (!bestForTarget || diff < bestForTarget.diff) {
        bestForTarget = {
          target: targetAnchor.position,
          diff,
          source: targetAnchor.source,
          itemId: targetAnchor.itemId,
          delta
        }
      }
    }

    if (!bestForTarget) return acc
    if (!acc || bestForTarget.diff < acc.diff) return bestForTarget
    return acc
  }, null)

  const snappedX = proposedX + (nearestX?.delta || 0)
  const snappedY = proposedY + (nearestY?.delta || 0)

  return {
    x: Math.round(snappedX),
    y: Math.round(snappedY),
    guideX: nearestX ? nearestX.target : null,
    guideY: nearestY ? nearestY.target : null,
    guideXSource: nearestX?.source || null,
    guideYSource: nearestY?.source || null,
    guideXTargetItemId: nearestX?.itemId,
    guideYTargetItemId: nearestY?.itemId
  }
}

type Params = {
  containerRef: RefObject<HTMLDivElement | null>
  parsedItems: ParsedItem[]
  snapThreshold?: number
  canvasScale?: number
}

export default function useCanvasSnapping({
  containerRef,
  parsedItems,
  snapThreshold = 12,
  canvasScale = 1
}: Params) {
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({
    x: null,
    y: null,
    xSource: null,
    ySource: null,
    xTargetItemId: undefined,
    yTargetItemId: undefined
  })

  const clearSnapGuides = () => {
    setSnapGuides((current) => {
      if (
        current.x === null &&
        current.y === null &&
        current.xSource === null &&
        current.ySource === null &&
        current.xTargetItemId === undefined &&
        current.yTargetItemId === undefined
      ) {
        return current
      }

      return {
        x: null,
        y: null,
        xSource: null,
        ySource: null,
        xTargetItemId: undefined,
        yTargetItemId: undefined
      }
    })
  }

  const syncSnapGuides = (snappedPosition: SnappedMovePosition) => {
    setSnapGuides((current) => {
      if (
        current.x === snappedPosition.guideX &&
        current.y === snappedPosition.guideY &&
        current.xSource === snappedPosition.guideXSource &&
        current.ySource === snappedPosition.guideYSource &&
        current.xTargetItemId === snappedPosition.guideXTargetItemId &&
        current.yTargetItemId === snappedPosition.guideYTargetItemId
      ) {
        return current
      }

      return {
        x: snappedPosition.guideX,
        y: snappedPosition.guideY,
        xSource: snappedPosition.guideXSource,
        ySource: snappedPosition.guideYSource,
        xTargetItemId: snappedPosition.guideXTargetItemId,
        yTargetItemId: snappedPosition.guideYTargetItemId
      }
    })
  }

  const getPointerPositionInCanvas = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    const rect = container?.getBoundingClientRect()
    if (!container || !rect) return { x: 0, y: 0 }
    const safeScale = Number.isFinite(canvasScale) && canvasScale > 0 ? canvasScale : 1
    const clientLeft = container.clientLeft
    const clientTop = container.clientTop

    return {
      x: (event.clientX - (rect.left + clientLeft)) / safeScale,
      y: (event.clientY - (rect.top + clientTop)) / safeScale
    }
  }

  const getSnappedMovePosition = (
    itemId: string,
    proposedX: number,
    proposedY: number,
    width: number,
    height: number
  ): SnappedMovePosition => {
    const container = containerRef.current
    if (!container) {
      return {
        x: Math.round(proposedX),
        y: Math.round(proposedY),
        guideX: null,
        guideY: null,
        guideXSource: null,
        guideYSource: null
      }
    }

    const baseWidth = container.clientWidth
    const baseHeight = container.clientHeight

    const safeScale = Number.isFinite(canvasScale) && canvasScale > 0 ? canvasScale : 1
    const effectiveSnapThreshold = snapThreshold / safeScale

    return computeSnappedMovePosition({
      itemId,
      proposedX,
      proposedY,
      width,
      height,
      baseWidth,
      baseHeight,
      parsedItems,
      snapThreshold: effectiveSnapThreshold
    })
  }

  return {
    snapGuides,
    clearSnapGuides,
    syncSnapGuides,
    getPointerPositionInCanvas,
    getSnappedMovePosition
  }
}
