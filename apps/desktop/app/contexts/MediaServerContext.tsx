import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo
} from 'react'

interface MediaServerContextType {
  port: number | null
  isReady: boolean
  buildMediaUrl: (filePath: string) => string
  setMediaServerHost: (host: string) => void
}

const MediaServerContext = createContext<MediaServerContextType | undefined>(undefined)

export function MediaServerProvider({ children }: { children: ReactNode }) {
  const [port, setPort] = useState<number | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [host, setHost] = useState('127.0.0.1')

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

  const buildMediaUrl = useCallback(
    (filePath: string): string => {
      if (!port || !filePath) return ''

      const normalizedPath = filePath.replace(/^\/+/, '')
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')
      return `http://${host}:${port}/media/${encodedPath}`
    },
    [port, host]
  )

  const contextValue = useMemo(
    () => ({ port, isReady, buildMediaUrl, setMediaServerHost: setHost }),
    [port, isReady, buildMediaUrl]
  )

  return <MediaServerContext.Provider value={contextValue}>{children}</MediaServerContext.Provider>
}

export function useMediaServer() {
  const context = useContext(MediaServerContext)
  if (context === undefined) {
    throw new Error('useMediaServer must be used within a MediaServerProvider')
  }
  return context
}
