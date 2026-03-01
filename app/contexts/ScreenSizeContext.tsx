import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import { ScreenSize } from '@/ui/PresentationView/types'
import { useDisplays } from './displayContext'

interface ScreenSizeContextType {
  getScreenSize: (maxHeight: number, displayId?: number) => ScreenSize
}

const ScreenSizeContext = createContext<ScreenSizeContextType | null>(null)

export function ScreenSizeProvider({ children }: { children: ReactNode }) {
  const { displays, mainDisplay } = useDisplays()
  const [triggerUpdate, setTriggerUpdate] = useState(0)

  // Escuchar resize una sola vez para toda la aplicación
  useEffect(() => {
    const handleResize = () => {
      setTriggerUpdate((prev) => prev + 1)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Memoizar la función de cálculo para que solo se recalcule cuando cambien displays o triggerUpdate
  const getScreenSize = useMemo(() => {
    // Cache por altura + display para evitar mezclar tamaños entre pantallas
    const cache = new Map<string, ScreenSize>()

    return (maxHeight: number, displayId?: number): ScreenSize => {
      const fallbackDisplay =
        displays.find((display) => display.type === 'LIVE_SCREEN') || mainDisplay || undefined

      const selectedDisplay =
        displayId !== undefined
          ? displays.find((display) => display.id === displayId) || fallbackDisplay
          : fallbackDisplay

      const cacheKey = `${maxHeight}-${selectedDisplay?.id ?? 'default'}`

      // Verificar si ya calculamos este escenario
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (!selectedDisplay || maxHeight <= 0) {
        const defaultSize: ScreenSize = { width: 0, height: 0, aspectRatio: '16 / 9' }
        cache.set(cacheKey, defaultSize)
        return defaultSize
      }

      const aspectRatio = selectedDisplay.aspectRatioCss || '16 / 9'

      // Extraer el aspect ratio para calcular proporcionalmente
      const [arWidthRaw, arHeightRaw] = aspectRatio.split('/').map((n) => parseFloat(n.trim()))
      const arWidth = Number.isFinite(arWidthRaw) && arWidthRaw > 0 ? arWidthRaw : 16
      const arHeight = Number.isFinite(arHeightRaw) && arHeightRaw > 0 ? arHeightRaw : 9
      const width = Math.round(maxHeight * (arWidth / arHeight))

      const screenSize: ScreenSize = {
        width,
        height: maxHeight,
        aspectRatio
      }

      cache.set(cacheKey, screenSize)
      return screenSize
    }
  }, [displays, mainDisplay, triggerUpdate]) // Solo recalcula cuando displays o triggerUpdate cambian

  return (
    <ScreenSizeContext.Provider value={{ getScreenSize }}>{children}</ScreenSizeContext.Provider>
  )
}

export function useScreenSize(maxHeight: number, displayId?: number): ScreenSize {
  const context = useContext(ScreenSizeContext)

  if (!context) {
    throw new Error('useScreenSize debe usarse dentro de ScreenSizeProvider')
  }

  // Este hook se re-ejecutará cuando el contexto cambie (displays o resize)
  return useMemo(() => context.getScreenSize(maxHeight, displayId), [context, maxHeight, displayId])
}
