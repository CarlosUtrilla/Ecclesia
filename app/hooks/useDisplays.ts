import { useEffect, useState } from 'react'
import type { DisplayInfo } from '../../electron/preload/index.d'

export interface DisplayWithUsage extends DisplayInfo {
  inUse: boolean
  usageType: 'public' | 'stage' | null
  aspectRatioCss: string
}

export function useDisplays() {
  const [displays, setDisplays] = useState<DisplayWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDisplays = async () => {
    try {
      setLoading(true)
      setError(null)

      const displayInfo = await window.systemAPI.getDisplays()

      // Mapear la información y agregar campos de uso
      // Por ahora, marcar todas como no en uso
      // En el futuro, puedes implementar lógica para rastrear qué pantallas están siendo utilizadas
      const displaysWithUsage: DisplayWithUsage[] = displayInfo.map((display) => ({
        ...display,
        inUse: false,
        usageType: null,
        // Generar el valor CSS para aspect-ratio
        aspectRatioCss: `${display.bounds.width} / ${display.bounds.height}`
      }))

      setDisplays(displaysWithUsage)
    } catch (err) {
      setError(err as Error)
      console.error('Error fetching displays:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDisplays()
  }, [])

  // Función para actualizar el estado de uso de una pantalla
  const setDisplayUsage = (
    displayId: number,
    inUse: boolean,
    usageType: 'public' | 'stage' | null = null
  ) => {
    setDisplays((prev) =>
      prev.map((display) =>
        display.id === displayId
          ? { ...display, inUse, usageType: inUse ? usageType : null }
          : display
      )
    )
  }

  // Función para refrescar la lista de pantallas
  const refresh = () => {
    fetchDisplays()
  }

  return {
    displays,
    loading,
    error,
    setDisplayUsage,
    refresh
  }
}
