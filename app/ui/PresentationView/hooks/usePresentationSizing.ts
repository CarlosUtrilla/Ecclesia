import { useEffect, useState } from 'react'
import { useResizeObserver } from 'usehooks-ts'
import { useScreenSize } from '@/contexts/ScreenSizeContext'

type UsePresentationSizingParams = {
  containerRef: React.RefObject<HTMLDivElement | null>
  live: boolean
  presentationHeight?: number
  maxHeight?: number
  displayId?: number
  customAspectRatio?: string
}

export function usePresentationSizing({
  containerRef,
  live,
  presentationHeight,
  maxHeight,
  displayId,
  customAspectRatio
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
  const defaultScreenSize = useScreenSize(effectiveHeight, displayId)

  const parsedAspect = customAspectRatio
    ?.split('/')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0)

  const hasValidCustomAspect = Boolean(parsedAspect && parsedAspect.length === 2)
  const customAspectWidth = hasValidCustomAspect ? parsedAspect?.[0] || 16 : 16
  const customAspectHeight = hasValidCustomAspect ? parsedAspect?.[1] || 9 : 9
  const customAspectRatioCss = hasValidCustomAspect
    ? `${customAspectWidth} / ${customAspectHeight}`
    : defaultScreenSize.aspectRatio

  const screenSize = hasValidCustomAspect
    ? {
        width: Math.round(effectiveHeight * (customAspectWidth / customAspectHeight)),
        height: effectiveHeight,
        aspectRatio: customAspectRatioCss
      }
    : defaultScreenSize

  return {
    screenSize,
    effectiveHeight
  }
}
