import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { ContentScreen, ILiveContext, ILiveProps } from './types'
import { useSchedule } from '.'
import { DisplayWithUsage, useDisplays } from '../displayContext'

const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children, selectedItemOnLive }: PropsWithChildren & ILiveProps) => {
  const { getScheduleItemContentScreen } = useSchedule()
  const { displays, mainDisplay } = useDisplays()
  const [itemIndex, setItemIndex] = useState(0)
  const [showLiveScreen, setShowLiveScreen] = useState(false)
  const [liveScreens, setLiveScreens] = useState<DisplayWithUsage[]>([])
  const [contentScreen, setContentScreen] = useState<ContentScreen | null>(null)
  const [windowsLiveScreenOpens, setWindowsLiveScreenOpens] = useState<number[]>([])

  useEffect(() => {
    setItemIndex(0)
    if (!showLiveScreen && selectedItemOnLive) {
      setShowLiveScreen(true)
    }
  }, [selectedItemOnLive])

  useEffect(() => {
    // Detectar si las pantallas live han cambiado y asignarlas al state interno
    if (displays.length > 0) {
      setLiveScreens(displays)
    } else {
      // Si no hay pantallas live configuradas, usar la principal como demo
      setLiveScreens(mainDisplay ? [mainDisplay] : [])
    }
  }, [displays])

  useEffect(() => {
    const fetchContentScreen = async () => {
      if (selectedItemOnLive) {
        const screen = await getScheduleItemContentScreen(selectedItemOnLive)
        setContentScreen(screen)
      } else {
        setContentScreen(null)
      }
    }
    fetchContentScreen()
  }, [selectedItemOnLive])

  useEffect(() => {
    if (liveScreens.length > 0 && showLiveScreen) {
      // Mostrar contenidfo en pantallas live
      const showScreens = async () => {
        const windowsIds: number[] = []
        for (const display of liveScreens) {
          const windowId = await window.displayAPI.showLiveScreen(display.id)
          windowsIds.push(windowId)
        }
        setWindowsLiveScreenOpens(windowsIds)
      }
      showScreens()
    } else if (!showLiveScreen) {
      // Cerrar ventanas live
      const closeScreens = async () => {
        for (const windowId of windowsLiveScreenOpens) {
          await window.displayAPI.closeLiveScreen(windowId)
        }
        setWindowsLiveScreenOpens([])
      }
      closeScreens()
    }
  }, [showLiveScreen])

  return (
    <LiveContext.Provider
      value={{
        itemIndex,
        setItemIndex,
        itemOnLive: selectedItemOnLive,
        liveScreens,
        showLiveScreen,
        setShowLiveScreen,
        contentScreen
      }}
    >
      {children}
    </LiveContext.Provider>
  )
}

export const useLive = () => {
  const ctx = useContext(LiveContext)
  return ctx
}
