import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiConfiguration } from '@ecclesia/queries'
import { useMediaServer } from '@/contexts/MediaServerContext'

export default function RemoteConnectionListener() {
  const { setApiConfiguration } = useApiConfiguration()
  const { setMediaServerHost } = useMediaServer()
  const queryClient = useQueryClient()

  const applyConnection = async (url: string, port: number) => {
    await setApiConfiguration(queryClient, url, port)
    setMediaServerHost(new URL(url).hostname)
    queryClient.clear()
  }

  const resetConnection = async () => {
    await setApiConfiguration(queryClient, 'http://localhost', 7777)
    setMediaServerHost('127.0.0.1')
    queryClient.clear()
  }

  useEffect(() => {
    window.remoteControlAPI.getConnectionState().then((state) => {
      if (state) {
        applyConnection(state.url, state.port)
      }
    })

    const cleanup = window.remoteControlAPI.onConnectionChanged((state) => {
      if (state) {
        applyConnection(state.url, state.port)
      } else {
        resetConnection()
      }
    })

    return cleanup
  }, [queryClient, setApiConfiguration, setMediaServerHost])

  return null
}
