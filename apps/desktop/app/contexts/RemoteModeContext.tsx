import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'

type RemoteModeContextType = {
  isRemoteMode: boolean
}

const RemoteModeContext = createContext<RemoteModeContextType>({ isRemoteMode: false })

export function RemoteModeProvider({ children }: PropsWithChildren) {
  const [isRemoteMode, setIsRemoteMode] = useState(false)

  useEffect(() => {
    window.remoteControlAPI.getConnectionState().then((state) => {
      setIsRemoteMode(!!state)
    })

    const cleanup = window.remoteControlAPI.onConnectionChanged((state) => {
      setIsRemoteMode(!!state)
    })

    return cleanup
  }, [])

  return (
    <RemoteModeContext.Provider value={{ isRemoteMode }}>
      {children}
    </RemoteModeContext.Provider>
  )
}

export function useRemoteMode(): RemoteModeContextType {
  return useContext(RemoteModeContext)
}
