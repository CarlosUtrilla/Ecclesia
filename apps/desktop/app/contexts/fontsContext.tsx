import { createContext, useContext, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMediaServer } from './MediaServerContext'
import { parseCustomFontVariant } from '@/lib/customFontUtils'

export type CustomFont = {
  id: number
  name: string
  fileName: string
  filePath: string
  createdAt: Date
}

interface FontsContextValue {
  fonts: CustomFont[]
  reloadFonts: () => void
}

const FontsContext = createContext<FontsContextValue | null>(null)

export function FontsProvider({ children }: { children: React.ReactNode }) {
  const { data: fonts = [], refetch } = useQuery({
    queryKey: ['fonts'],
    queryFn: async () => await window.api.fonts.getAllFonts(),
    staleTime: Infinity
  })

  // Listener IPC para refetch cuando se agregue una fuente
  useEffect(() => {
    const handler = () => {
      refetch()
    }
    window.electron.ipcRenderer.on('font-added', handler)
    window.electron.ipcRenderer.on('font-deleted', handler)
    return () => {
      window.electron.ipcRenderer.removeListener('font-added', handler)
      window.electron.ipcRenderer.removeListener('font-deleted', handler)
    }
  }, [refetch])

  // Cargar todas las fuentes personalizadas globalmente
  const { buildMediaUrl } = useMediaServer()
  useEffect(() => {
    fonts.forEach((font) => {
      if (!document.getElementById('font-' + font.fileName)) {
        const fontUrl = buildMediaUrl(font.filePath)
        const parsedVariant = parseCustomFontVariant(font.fileName || font.name)
        const style = document.createElement('style')
        style.id = 'font-' + font.fileName
        style.innerHTML = `@font-face { font-family: '${parsedVariant.family}'; src: url('${fontUrl}'); font-style: ${parsedVariant.style}; font-weight: ${parsedVariant.weight}; font-display: swap; }`
        document.head.appendChild(style)
      }
    })
  }, [fonts, buildMediaUrl])

  return (
    <FontsContext.Provider value={{ fonts, reloadFonts: () => refetch() }}>
      {children}
    </FontsContext.Provider>
  )
}

export function useFontsContext() {
  const ctx = useContext(FontsContext)
  if (!ctx) throw new Error('useFontsContext debe usarse dentro de FontsProvider')
  return ctx
}
