import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { ILiveContext, ILiveProps } from './types'

const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children, selectedItemOnLive }: PropsWithChildren & ILiveProps) => {
  const [itemIndex, setItemIndex] = useState(0)

  useEffect(() => {
    setItemIndex(0)
  }, [selectedItemOnLive])
  return <LiveContext.Provider value={{ itemIndex, setItemIndex }}>{children}</LiveContext.Provider>
}

export const useLive = () => {
  const ctx = useContext(LiveContext)
  return ctx
}
