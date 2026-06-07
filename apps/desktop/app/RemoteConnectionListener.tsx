import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiConfiguration } from '@ecclesia/queries'
import { switchSSEConnection } from '@/lib/sseEvents'

export default function RemoteConnectionListener() {
  const { setApiConfiguration } = useApiConfiguration()
  const queryClient = useQueryClient()

  useEffect(() => {
    window.remoteControlAPI.getConnectionState().then((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        switchSSEConnection(state.url)
      }
    })

    const cleanup = window.remoteControlAPI.onConnectionChanged((state) => {
      if (state) {
        setApiConfiguration(queryClient, state.url, state.port)
        switchSSEConnection(state.url)
      } else {
        setApiConfiguration(queryClient, 'http://localhost', 7777)
        switchSSEConnection(null)
      }
    })

    return cleanup
  }, [])

  return null
}
