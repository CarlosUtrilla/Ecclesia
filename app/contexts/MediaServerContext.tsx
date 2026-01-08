import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface MediaServerContextType {
  port: number | null
  isReady: boolean
  buildMediaUrl: (filePath: string) => string
}

const MediaServerContext = createContext<MediaServerContextType | undefined>(undefined)

export function MediaServerProvider({ children }: { children: ReactNode }) {
  const [port, setPort] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initializeServer = async () => {
      try {
        const serverPort = await window.mediaAPI.getServerPort()
        setPort(serverPort)
        setIsReady(true)
      } catch (error) {
        console.error('Error initializing media server:', error)
        setIsReady(true) // Continuar de todos modos
      }
    }

    initializeServer()
  }, [])

  const buildMediaUrl = (filePath: string): string => {
    if (!port || !filePath) return ''
    const encodedPath = encodeURIComponent(filePath)
    return `http://127.0.0.1:${port}/${encodedPath}`
  }
  return (
    <MediaServerContext.Provider value={{ port, isReady, buildMediaUrl }}>
      {children}
    </MediaServerContext.Provider>
  )
}

export function useMediaServer() {
  const context = useContext(MediaServerContext)
  if (context === undefined) {
    throw new Error('useMediaServer must be used within a MediaServerProvider')
  }
  return context
}
