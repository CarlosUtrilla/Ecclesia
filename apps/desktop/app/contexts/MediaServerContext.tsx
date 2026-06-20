import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo
} from 'react'

const MEDIA_SERVER_PORT = 7777

interface MediaServerContextType {
  port: number
  isReady: boolean
  buildMediaUrl: (filePath: string) => string
  setMediaServerHost: (host: string) => void
}

const MediaServerContext = createContext<MediaServerContextType | undefined>(undefined)

export function MediaServerProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState('127.0.0.1')

  const buildMediaUrl = useCallback(
    (filePath: string): string => {
      if (!filePath) return ''

      const normalizedPath = filePath.replace(/^\/+/, '')
      const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')
      return `http://${host}:${MEDIA_SERVER_PORT}/media/${encodedPath}`
    },
    [host]
  )

  const contextValue = useMemo(
    () => ({ port: MEDIA_SERVER_PORT, isReady: true, buildMediaUrl, setMediaServerHost: setHost }),
    [buildMediaUrl]
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
