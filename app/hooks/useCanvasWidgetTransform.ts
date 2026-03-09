import { useCallback, useEffect, useRef } from 'react'

export type WidgetResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'

type WidgetRect = {
  x: number
  y: number
  w: number
  h: number
}

type ActiveTransform = {
  pointerId?: number
  widgetId: string
  mode: 'move' | 'resize'
  handle?: WidgetResizeHandle
  startClientX: number
  startClientY: number
  startRect: WidgetRect
}

type UseCanvasWidgetTransformParams = {
  canvasRef: React.RefObject<HTMLDivElement | null>
  minWidth?: number
  minHeight?: number
  snap?: (value: number) => number
  onUpdateWidgetRect: (widgetId: string, nextRect: WidgetRect) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function useCanvasWidgetTransform({
  canvasRef,
  minWidth = 8,
  minHeight = 6,
  snap,
  onUpdateWidgetRect
}: UseCanvasWidgetTransformParams) {
  const activeRef = useRef<ActiveTransform | null>(null)

  const getPointerId = (event: { pointerId?: number }) => {
    return Number.isFinite(event.pointerId) ? event.pointerId : undefined
  }

  const applySnap = useCallback(
    (value: number) => {
      if (!snap) return value
      return snap(value)
    },
    [snap]
  )

  const applyResize = useCallback(
    (active: ActiveTransform, deltaXPercent: number, deltaYPercent: number) => {
      const start = active.startRect
      const startLeft = start.x
      const startTop = start.y
      const startRight = start.x + start.w
      const startBottom = start.y + start.h

      let nextLeft = startLeft
      let nextRight = startRight
      let nextTop = startTop
      let nextBottom = startBottom

      const handle = active.handle ?? 'bottom-right'

      if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
        nextLeft = applySnap(startLeft + deltaXPercent)
      }
      if (handle === 'right' || handle === 'top-right' || handle === 'bottom-right') {
        nextRight = applySnap(startRight + deltaXPercent)
      }
      if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
        nextTop = applySnap(startTop + deltaYPercent)
      }
      if (handle === 'bottom' || handle === 'bottom-left' || handle === 'bottom-right') {
        nextBottom = applySnap(startBottom + deltaYPercent)
      }

      nextLeft = clamp(nextLeft, 0, 100)
      nextRight = clamp(nextRight, 0, 100)
      nextTop = clamp(nextTop, 0, 100)
      nextBottom = clamp(nextBottom, 0, 100)

      let nextWidth = nextRight - nextLeft
      let nextHeight = nextBottom - nextTop

      if (nextWidth < minWidth) {
        if (handle === 'left' || handle === 'top-left' || handle === 'bottom-left') {
          nextLeft = nextRight - minWidth
        } else {
          nextRight = nextLeft + minWidth
        }
      }

      if (nextHeight < minHeight) {
        if (handle === 'top' || handle === 'top-left' || handle === 'top-right') {
          nextTop = nextBottom - minHeight
        } else {
          nextBottom = nextTop + minHeight
        }
      }

      nextLeft = clamp(nextLeft, 0, 100 - minWidth)
      nextTop = clamp(nextTop, 0, 100 - minHeight)
      nextRight = clamp(nextRight, minWidth, 100)
      nextBottom = clamp(nextBottom, minHeight, 100)

      nextWidth = clamp(nextRight - nextLeft, minWidth, 100)
      nextHeight = clamp(nextBottom - nextTop, minHeight, 100)

      const clampedX = clamp(nextLeft, 0, 100 - nextWidth)
      const clampedY = clamp(nextTop, 0, 100 - nextHeight)

      return {
        x: clampedX,
        y: clampedY,
        w: nextWidth,
        h: nextHeight
      }
    },
    [applySnap, minHeight, minWidth]
  )

  const applyTransformAtClientPosition = useCallback(
    (clientX: number, clientY: number) => {
      const active = activeRef.current
      const canvas = canvasRef.current
      if (!active || !canvas) return

      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const deltaXPercent = ((clientX - active.startClientX) / rect.width) * 100
      const deltaYPercent = ((clientY - active.startClientY) / rect.height) * 100

      if (active.mode === 'move') {
        const nextW = active.startRect.w
        const nextH = active.startRect.h
        const nextX = clamp(applySnap(active.startRect.x + deltaXPercent), 0, 100 - nextW)
        const nextY = clamp(applySnap(active.startRect.y + deltaYPercent), 0, 100 - nextH)

        onUpdateWidgetRect(active.widgetId, {
          x: nextX,
          y: nextY,
          w: nextW,
          h: nextH
        })
        return
      }

      onUpdateWidgetRect(active.widgetId, applyResize(active, deltaXPercent, deltaYPercent))
    },
    [applyResize, applySnap, canvasRef, onUpdateWidgetRect]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const active = activeRef.current
      if (!active) return
      if (active.pointerId !== undefined && event.pointerId !== active.pointerId) return
      applyTransformAtClientPosition(event.clientX, event.clientY)
    },
    [applyTransformAtClientPosition]
  )

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const active = activeRef.current
      if (!active) return
      applyTransformAtClientPosition(event.clientX, event.clientY)
    },
    [applyTransformAtClientPosition]
  )

  const stopTransform = useCallback(() => {
    activeRef.current = null
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('pointerup', stopTransform)
    window.removeEventListener('mouseup', stopTransform)
  }, [handleMouseMove, handlePointerMove])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('pointerup', stopTransform)
      window.removeEventListener('mouseup', stopTransform)
    }
  }, [handleMouseMove, handlePointerMove, stopTransform])

  const startMove = useCallback(
    (event: React.PointerEvent, widgetId: string, startRect: WidgetRect) => {
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      activeRef.current = {
        pointerId: getPointerId(event),
        widgetId,
        mode: 'move',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('pointerup', stopTransform)
      window.addEventListener('mouseup', stopTransform)
    },
    [handleMouseMove, handlePointerMove, stopTransform]
  )

  const startResize = useCallback(
    (
      event: React.PointerEvent,
      widgetId: string,
      startRect: WidgetRect,
      handle: WidgetResizeHandle
    ) => {
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      activeRef.current = {
        pointerId: getPointerId(event),
        widgetId,
        mode: 'resize',
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('pointerup', stopTransform)
      window.addEventListener('mouseup', stopTransform)
    },
    [handleMouseMove, handlePointerMove, stopTransform]
  )

  return {
    startMove,
    startResize
  }
}
