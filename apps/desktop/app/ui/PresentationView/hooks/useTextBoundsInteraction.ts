import { useCallback, useEffect, useRef, useState } from 'react'
import { TextBoundsValues } from '../types'

const SNAP_CENTER_THRESHOLD = 8 // px lógicos — umbral para snap al centro

export type BoundsSnapGuides = {
  centerX: boolean
  centerY: boolean
}

export type BoundsInteractionMode =
  | 'move'
  | 'resize-left'
  | 'resize-right'
  | 'resize-top'
  | 'resize-bottom'
  | 'resize-top-left'
  | 'resize-top-right'
  | 'resize-bottom-left'
  | 'resize-bottom-right'

type ActiveBoundsInteraction = {
  mode: BoundsInteractionMode
  startX: number
  startY: number
  startValues: TextBoundsValues
}

type UseTextBoundsInteractionParams = {
  canEditBounds: boolean
  textBoundsBaseValues?: TextBoundsValues
  textBoundsScale?: {
    x: number
    y: number
  }
  onTextBoundsChange?: (next: TextBoundsValues) => void
  allowedModes?: BoundsInteractionMode[]
  lockTranslateX?: boolean
  lockTranslateY?: boolean
  lockPaddingInline?: boolean
  lockPaddingBlock?: boolean
  snapAxes?: {
    x?: boolean
    y?: boolean
  }
}

export const resolveAllowedInteractionMode = (
  nextMode: BoundsInteractionMode,
  allowedModes?: BoundsInteractionMode[]
) => {
  if (!allowedModes || allowedModes.includes(nextMode)) {
    return nextMode
  }

  if (
    (nextMode === 'resize-top-left' || nextMode === 'resize-bottom-left') &&
    allowedModes.includes('resize-left')
  ) {
    return 'resize-left'
  }

  if (
    (nextMode === 'resize-top-right' || nextMode === 'resize-bottom-right') &&
    allowedModes.includes('resize-right')
  ) {
    return 'resize-right'
  }

  if (
    (nextMode === 'resize-top-left' || nextMode === 'resize-top-right') &&
    allowedModes.includes('resize-top')
  ) {
    return 'resize-top'
  }

  if (
    (nextMode === 'resize-bottom-left' || nextMode === 'resize-bottom-right') &&
    allowedModes.includes('resize-bottom')
  ) {
    return 'resize-bottom'
  }

  if (allowedModes.includes('move')) {
    return 'move'
  }

  return allowedModes[0] || 'move'
}

export function useTextBoundsInteraction({
  canEditBounds,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange,
  allowedModes,
  lockTranslateX = false,
  lockTranslateY = false,
  lockPaddingInline = false,
  lockPaddingBlock = false,
  snapAxes
}: UseTextBoundsInteractionParams) {
  const activeInteractionRef = useRef<ActiveBoundsInteraction | null>(null)
  const captureTargetRef = useRef<HTMLElement | null>(null)
  const capturePointerIdRef = useRef<number | null>(null)
  const [boundsCursor, setBoundsCursor] = useState<React.CSSProperties['cursor']>('move')
  const [snapGuides, setSnapGuides] = useState<BoundsSnapGuides>({ centerX: false, centerY: false })

  const applyBoundsChange = useCallback(
    (nextValues: TextBoundsValues) => {
      if (!onTextBoundsChange) return

      const paddingInline = Math.max(0, Math.round(nextValues.paddingInline))
      const paddingBlock = Math.max(0, Math.round(nextValues.paddingBlock))
      const translateX = Math.max(
        -paddingInline,
        Math.min(paddingInline, Math.round(nextValues.translateX))
      )
      const translateY = Math.max(
        -paddingBlock,
        Math.min(paddingBlock, Math.round(nextValues.translateY))
      )

      onTextBoundsChange({
        paddingInline,
        paddingBlock,
        translateX,
        translateY
      })
    },
    [onTextBoundsChange]
  )

  const detectInteractionMode = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.currentTarget.getBoundingClientRect()
      const edgeThreshold = 10
      const offsetX = event.clientX - target.left
      const offsetY = event.clientY - target.top

      const nearLeft = offsetX <= edgeThreshold
      const nearRight = target.width - offsetX <= edgeThreshold
      const nearTop = offsetY <= edgeThreshold
      const nearBottom = target.height - offsetY <= edgeThreshold

      let nextMode: BoundsInteractionMode = 'move'

      if (nearTop && nearLeft) nextMode = 'resize-top-left'
      else if (nearTop && nearRight) nextMode = 'resize-top-right'
      else if (nearBottom && nearLeft) nextMode = 'resize-bottom-left'
      else if (nearBottom && nearRight) nextMode = 'resize-bottom-right'
      else if (nearLeft && !nearTop && !nearBottom) nextMode = 'resize-left'
      else if (nearRight && !nearTop && !nearBottom) nextMode = 'resize-right'
      else if (nearTop) nextMode = 'resize-top'
      else if (nearBottom) nextMode = 'resize-bottom'

      return resolveAllowedInteractionMode(nextMode, allowedModes)
    },
    [allowedModes]
  )

  const getCursorFromMode = useCallback((mode: BoundsInteractionMode) => {
    if (mode === 'resize-top-left' || mode === 'resize-bottom-right') return 'nwse-resize'
    if (mode === 'resize-top-right' || mode === 'resize-bottom-left') return 'nesw-resize'
    if (mode === 'resize-left' || mode === 'resize-right') return 'ew-resize'
    if (mode === 'resize-top' || mode === 'resize-bottom') return 'ns-resize'
    return 'move'
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!canEditBounds || !textBoundsScale) return

      const activeInteraction = activeInteractionRef.current
      if (!activeInteraction) return

      const deltaXInBase = (event.clientX - activeInteraction.startX) / textBoundsScale.x
      const deltaYInBase = (event.clientY - activeInteraction.startY) / textBoundsScale.y

      const start = activeInteraction.startValues
      let nextPaddingInline = start.paddingInline
      let nextPaddingBlock = start.paddingBlock
      let nextTranslateX = start.translateX
      let nextTranslateY = start.translateY
      const mode = activeInteraction.mode

      if (mode === 'move') {
        const rawX = start.translateX + deltaXInBase
        const rawY = start.translateY + deltaYInBase
        const snapX = snapAxes?.x !== false && Math.abs(rawX) < SNAP_CENTER_THRESHOLD
        const snapY = snapAxes?.y !== false && Math.abs(rawY) < SNAP_CENTER_THRESHOLD
        nextTranslateX = snapX ? 0 : rawX
        nextTranslateY = snapY ? 0 : rawY
        setSnapGuides({ centerX: snapX, centerY: snapY })
      } else {
        setSnapGuides({ centerX: false, centerY: false })
      }

      if (mode === 'resize-left' || mode === 'resize-top-left' || mode === 'resize-bottom-left') {
        const nextLeftMargin = Math.max(0, start.paddingInline + start.translateX + deltaXInBase)
        const fixedRightMargin = Math.max(0, start.paddingInline - start.translateX)
        nextPaddingInline = (nextLeftMargin + fixedRightMargin) / 2
        nextTranslateX = (nextLeftMargin - fixedRightMargin) / 2
      }

      if (
        mode === 'resize-right' ||
        mode === 'resize-top-right' ||
        mode === 'resize-bottom-right'
      ) {
        const fixedLeftMargin = Math.max(0, start.paddingInline + start.translateX)
        const nextRightMargin = Math.max(0, start.paddingInline - start.translateX - deltaXInBase)
        nextPaddingInline = (fixedLeftMargin + nextRightMargin) / 2
        nextTranslateX = (fixedLeftMargin - nextRightMargin) / 2
      }

      if (mode === 'resize-top' || mode === 'resize-top-left' || mode === 'resize-top-right') {
        const nextTopMargin = Math.max(0, start.paddingBlock + start.translateY + deltaYInBase)
        const fixedBottomMargin = Math.max(0, start.paddingBlock - start.translateY)
        nextPaddingBlock = (nextTopMargin + fixedBottomMargin) / 2
        nextTranslateY = (nextTopMargin - fixedBottomMargin) / 2
      }

      if (
        mode === 'resize-bottom' ||
        mode === 'resize-bottom-left' ||
        mode === 'resize-bottom-right'
      ) {
        const fixedTopMargin = Math.max(0, start.paddingBlock + start.translateY)
        const nextBottomMargin = Math.max(0, start.paddingBlock - start.translateY - deltaYInBase)
        nextPaddingBlock = (fixedTopMargin + nextBottomMargin) / 2
        nextTranslateY = (fixedTopMargin - nextBottomMargin) / 2
      }

      if (lockPaddingInline) {
        nextPaddingInline = start.paddingInline
      }

      if (lockPaddingBlock) {
        nextPaddingBlock = start.paddingBlock
      }

      if (lockTranslateX) {
        nextTranslateX = start.translateX
      }

      if (lockTranslateY) {
        nextTranslateY = start.translateY
      }

      applyBoundsChange({
        paddingInline: nextPaddingInline,
        paddingBlock: nextPaddingBlock,
        translateX: nextTranslateX,
        translateY: nextTranslateY
      })
    },
    [
      applyBoundsChange,
      canEditBounds,
      lockPaddingBlock,
      lockPaddingInline,
      lockTranslateX,
      lockTranslateY,
      setSnapGuides,
      snapAxes?.x,
      snapAxes?.y,
      textBoundsScale
    ]
  )

  const stopInteraction = useCallback(() => {
    const captureTarget = captureTargetRef.current
    const pointerId = capturePointerIdRef.current

    if (
      captureTarget &&
      pointerId !== null &&
      typeof captureTarget.hasPointerCapture === 'function' &&
      captureTarget.hasPointerCapture(pointerId)
    ) {
      captureTarget.releasePointerCapture(pointerId)
    }

    captureTargetRef.current = null
    capturePointerIdRef.current = null
    activeInteractionRef.current = null
    setBoundsCursor('move')
    setSnapGuides({ centerX: false, centerY: false })
    document.body.style.cursor = ''
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopInteraction)
  }, [handlePointerMove])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [handlePointerMove, stopInteraction])

  const startInteraction = useCallback(
    (mode: BoundsInteractionMode, event: React.PointerEvent<HTMLElement>) => {
      if (!canEditBounds || !textBoundsBaseValues) return
      event.preventDefault()
      event.stopPropagation()

      activeInteractionRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startValues: {
          ...textBoundsBaseValues
        }
      }

      const targetElement = event.currentTarget as HTMLElement
      if (typeof targetElement.setPointerCapture === 'function') {
        targetElement.setPointerCapture(event.pointerId)
        captureTargetRef.current = targetElement
        capturePointerIdRef.current = event.pointerId
      }

      const cursor = getCursorFromMode(mode)
      setBoundsCursor(cursor)
      document.body.style.cursor = cursor

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopInteraction)
    },
    [canEditBounds, getCursorFromMode, handlePointerMove, stopInteraction, textBoundsBaseValues]
  )

  const onBoundsPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canEditBounds || activeInteractionRef.current) return
      const mode = detectInteractionMode(event)
      setBoundsCursor(getCursorFromMode(mode))
    },
    [canEditBounds, detectInteractionMode, getCursorFromMode]
  )

  const onBoundsPointerLeave = useCallback(() => {
    if (!activeInteractionRef.current) {
      setBoundsCursor('move')
    }
  }, [])

  const onBoundsPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const mode = detectInteractionMode(event)
      startInteraction(mode, event)
    },
    [detectInteractionMode, startInteraction]
  )

  return {
    activeInteractionRef,
    boundsCursor,
    snapGuides,
    onBoundsPointerMove,
    onBoundsPointerLeave,
    onBoundsPointerDown,
    startInteraction
  }
}
