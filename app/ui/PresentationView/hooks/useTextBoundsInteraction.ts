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
}

export function useTextBoundsInteraction({
  canEditBounds,
  textBoundsBaseValues,
  textBoundsScale,
  onTextBoundsChange
}: UseTextBoundsInteractionParams) {
  const activeInteractionRef = useRef<ActiveBoundsInteraction | null>(null)
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

  const detectInteractionMode = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget.getBoundingClientRect()
    const edgeThreshold = 10
    const offsetX = event.clientX - target.left
    const offsetY = event.clientY - target.top

    const nearLeft = offsetX <= edgeThreshold
    const nearRight = target.width - offsetX <= edgeThreshold
    const nearTop = offsetY <= edgeThreshold
    const nearBottom = target.height - offsetY <= edgeThreshold

    if (nearTop && nearLeft) return 'resize-top-left'
    if (nearTop && nearRight) return 'resize-top-right'
    if (nearBottom && nearLeft) return 'resize-bottom-left'
    if (nearBottom && nearRight) return 'resize-bottom-right'

    if (nearLeft && !nearTop && !nearBottom) return 'resize-left'
    if (nearRight && !nearTop && !nearBottom) return 'resize-right'
    if (nearTop) return 'resize-top'
    if (nearBottom) return 'resize-bottom'
    return 'move'
  }, [])

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
        const snapX = Math.abs(rawX) < SNAP_CENTER_THRESHOLD
        const snapY = Math.abs(rawY) < SNAP_CENTER_THRESHOLD
        nextTranslateX = snapX ? 0 : rawX
        nextTranslateY = snapY ? 0 : rawY
        setSnapGuides({ centerX: snapX, centerY: snapY })
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

      applyBoundsChange({
        paddingInline: nextPaddingInline,
        paddingBlock: nextPaddingBlock,
        translateX: nextTranslateX,
        translateY: nextTranslateY
      })
    },
    [applyBoundsChange, canEditBounds, setSnapGuides, textBoundsScale]
  )

  const stopInteraction = useCallback(() => {
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
