import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiConfiguration } from '@ecclesia/queries'
import { useMediaServer } from '@/contexts/MediaServerContext'

export default function RemoteConnectionListener() {
  const { setApiConfiguration } = useApiConfiguration()
  const { setMediaServerHost } = useMediaServer()
  const queryClient = useQueryClient()

  useEffect(() => {
    window.remoteControlAPI.getConnectionState().then((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        setMediaServerHost(new URL(state.url).hostname)
        window.remoteControlAPI.invalidateAllWindows()
      }
    })

    const cleanup = window.remoteControlAPI.onConnectionChanged((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        setMediaServerHost(new URL(state.url).hostname)
        window.remoteControlAPI.invalidateAllWindows()
      } else {
        setApiConfiguration(queryClient, 'http://localhost', 7777)
        setMediaServerHost('127.0.0.1')
        window.remoteControlAPI.invalidateAllWindows()
      }
    })

    return cleanup
  }, [])

  return null
}
