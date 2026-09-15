import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreenSize } from '@/contexts/ScreenSizeContext'

type UsePresentationSizingParams = {
  presentationHeight?: number
  maxHeight?: number
  displayId?: number
  customAspectRatio?: string
}

// El alto se lee del border box, no de `getBoundingClientRect()`: durante las
// transiciones de tema/slide el contenedor puede estar escalado (`zoomIn`,
// `scale`...) y el rect devolveria el alto ya transformado, dejando la fuente
// calculada mas pequena de lo que toca.
function readBorderBoxHeight(entry: ResizeObserverEntry, node: HTMLElement): number {
  const borderBoxSize = entry.borderBoxSize
  if (Array.isArray(borderBoxSize) && borderBoxSize.length > 0) {
    return borderBoxSize[0].blockSize
  }
  return node.offsetHeight
}

export function usePresentationSizing({
  presentationHeight,
  maxHeight,
  displayId,
  customAspectRatio
}: UsePresentationSizingParams) {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  // Ref callback en lugar de `useResizeObserver`: el hook solo se suscribe una
  // vez, asi que si el nodo todavia no existe en ese commit (PresentationView
  // devuelve null mientras no hay items, algo habitual al arrancar la app) el
  // observer nunca llegaba a engancharse y el alto se quedaba a 0 para siempre.
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node) return

    if (node.offsetHeight > 0) {
      setMeasuredHeight((prev) => (prev !== node.offsetHeight ? node.offsetHeight : prev))
    }

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const nextHeight = readBorderBoxHeight(entry, node)
      // Un alto 0 (nodo saliendo de pantalla, ventana oculta) no debe borrar la
      // ultima medida buena: dejaria la fuente en 0px durante la transicion.
      if (nextHeight > 0) {
        setMeasuredHeight((prev) => (prev !== nextHeight ? nextHeight : prev))
      }
    })

    observer.observe(node, { box: 'border-box' })
    observerRef.current = observer
  }, [])

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

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
    containerRef,
    screenSize,
    effectiveHeight
  }
}
