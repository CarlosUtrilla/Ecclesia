import { useEffect, useState } from 'react'
import { useResizeObserver } from 'usehooks-ts'
import { useScreenSize } from '@/contexts/ScreenSizeContext'

type UsePresentationSizingParams = {
  containerRef: React.RefObject<HTMLDivElement | null>
  live: boolean
  presentationHeight?: number
  maxHeight?: number
  displayId?: number
}

export function usePresentationSizing({
  containerRef,
  live,
  presentationHeight,
  maxHeight,
  displayId
}: UsePresentationSizingParams) {
  const [lastMeasuredHeight, setLastMeasuredHeight] = useState(0)
  const { height = 0 } = useResizeObserver({
    ref: containerRef as React.RefObject<HTMLElement>,
    box: 'border-box'
  })

  useEffect(() => {
    if (height > 0) {
      setLastMeasuredHeight((prev) => (prev !== height ? height : prev))
      return
    }

    if (!live || lastMeasuredHeight > 0) return

    let frameId = 0
    const measureUntilReady = () => {
      const nextHeight = containerRef.current?.getBoundingClientRect().height ?? 0
      if (nextHeight > 0) {
        setLastMeasuredHeight((prev) => (prev !== nextHeight ? nextHeight : prev))
        return
      }
      frameId = requestAnimationFrame(measureUntilReady)
    }

    frameId = requestAnimationFrame(measureUntilReady)
    return () => cancelAnimationFrame(frameId)
  }, [height, live, lastMeasuredHeight, containerRef])

  const measuredHeight = height > 0 ? height : lastMeasuredHeight
  const effectiveHeight = measuredHeight || presentationHeight || maxHeight || 0
  const screenSize = useScreenSize(effectiveHeight, displayId)

  return {
    screenSize,
    effectiveHeight
  }
}
