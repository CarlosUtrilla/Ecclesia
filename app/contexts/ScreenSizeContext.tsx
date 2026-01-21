import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import { ScreenSize } from '@/components/PresentationView/types'
import { useDisplays } from './displayContext'

interface ScreenSizeContextType {
  getScreenSize: (maxHeight: number, displayId?: number) => ScreenSize
}

const ScreenSizeContext = createContext<ScreenSizeContextType | null>(null)

export function ScreenSizeProvider({ children }: { children: ReactNode }) {
  const { displays } = useDisplays()
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
    // Cache para diferentes maxHeight values
    const cache = new Map<number, ScreenSize>()

    return (maxHeight: number, displayId?: number): ScreenSize => {
      // Verificar si ya calculamos este maxHeight
      const cached = cache.get(maxHeight)
      if (cached) return cached

      // Encontrar el display público
      const publicDisplay = displayId
        ? displays.find((d) => d.id === displayId)
        : displays.find((display) => display.type === 'LIVE_SCREEN') || displays[0]

      if (!publicDisplay) {
        const defaultSize: ScreenSize = { width: 0, height: 0, aspectRatio: '16 / 9' }
        cache.set(maxHeight, defaultSize)
        return defaultSize
      }

      const aspectRatio = publicDisplay.aspectRatioCss

      // Extraer el aspect ratio para calcular proporcionalmente
      const [arWidth, arHeight] = aspectRatio.split('/').map((n) => parseFloat(n.trim()))
      const width = Math.round(maxHeight * (arWidth / arHeight))

      const screenSize: ScreenSize = {
        width,
        height: maxHeight,
        aspectRatio
      }

      cache.set(maxHeight, screenSize)
      return screenSize
    }
  }, [displays, triggerUpdate]) // Solo recalcula cuando displays o triggerUpdate cambian

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
