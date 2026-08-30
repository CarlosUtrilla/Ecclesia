import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useApiConfiguration,
  Api,
  onSocketChange,
  DEFAULT_API_URL,
  DEFAULT_API_PORT
} from '@ecclesia/queries'
import { useMediaServer } from '@/contexts/MediaServerContext'

export default function RemoteConnectionListener() {
  const { setApiConfiguration } = useApiConfiguration()
  const { setMediaServerHost } = useMediaServer()
  const queryClient = useQueryClient()

  useEffect(() => {
    const registerListener = () => {
      const unsub = Api.socket.listen.queryKeysInvalidate(({ keys }) => {
        if (keys && keys.length > 0) {
          keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
        } else {
          queryClient.invalidateQueries()
        }
      })
      return unsub
    }

    const unsubs: (() => void)[] = [registerListener()]

    const unsubChange = onSocketChange(() => {
      unsubs.forEach((fn) => fn())
      unsubs.length = 0
      unsubs.push(registerListener())
    })
    unsubs.push(unsubChange)

    window.remoteControlAPI.getConnectionState().then(async (state) => {
      if (state) {
        await setApiConfiguration(queryClient, state.url, state.port)
        setMediaServerHost(new URL(state.url).hostname)
        window.remoteControlAPI.invalidateAllWindows()
      }
    })

    const unsubConnection = window.remoteControlAPI.onConnectionChanged(async (state) => {
      if (state) {
        await setApiConfiguration(queryClient, state.url, state.port)
        setMediaServerHost(new URL(state.url).hostname)
        window.remoteControlAPI.invalidateAllWindows()
      } else {
        await setApiConfiguration(queryClient, DEFAULT_API_URL, DEFAULT_API_PORT)
        setMediaServerHost('127.0.0.1')
        window.remoteControlAPI.invalidateAllWindows()
      }
    })

    return () => {
      unsubs.forEach((fn) => fn())
      unsubConnection()
    }
  }, [])

  return null
}
