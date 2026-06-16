import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiConfiguration } from '@ecclesia/queries'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { switchSSEConnection } from '@/lib/sseEvents'
import { connectSyncProgress } from '@/lib/syncProgressService'

export default function RemoteConnectionListener() {
  const { setApiConfiguration } = useApiConfiguration()
  const { setMediaServerHost } = useMediaServer()
  const queryClient = useQueryClient()

  useEffect(() => {
    window.remoteControlAPI.getConnectionState().then((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        switchSSEConnection(state.url)
        setMediaServerHost(new URL(state.url).hostname)
        connectSyncProgress(state.url, state.port)
        window.remoteControlAPI.invalidateAllWindows()
      } else {
        connectSyncProgress('http://127.0.0.1', 7777)
      }
    })

    const cleanup = window.remoteControlAPI.onConnectionChanged((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        switchSSEConnection(state.url)
        setMediaServerHost(new URL(state.url).hostname)
        connectSyncProgress(state.url, state.port)
        window.remoteControlAPI.invalidateAllWindows()
      } else {
        setApiConfiguration(queryClient, 'http://localhost', 7777)
        switchSSEConnection(null)
        setMediaServerHost('127.0.0.1')
        connectSyncProgress('http://127.0.0.1', 7777)
        window.remoteControlAPI.invalidateAllWindows()
      }
    })

    return cleanup
  }, [])

  return null
}
