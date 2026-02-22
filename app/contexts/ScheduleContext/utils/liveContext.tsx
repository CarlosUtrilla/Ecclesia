import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { ContentScreen, ILiveContext } from '../types'
import { useSchedule } from '..'
import { DisplayWithUsage, useDisplays } from '../../displayContext'
import { ScheduleItem } from '@prisma/client'

// Extensión: stub para sincronización de media
type LiveMediaState = { action: 'play' | 'pause' | 'seek' | 'restart'; time: number }
const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children }: PropsWithChildren) => {
  // Stub para sincronización de media (debe implementarse con IPC)
  const sendLiveMediaState = (state: LiveMediaState) => {
    // Aquí se debe emitir por IPC a la ventana de pantalla en vivo
    window.electron?.ipcRenderer?.send?.('live-media-state', state)
  }
  const { getScheduleItemContentScreen, itemOnLive, selectedTheme, setItemOnLive } = useSchedule()
  const { displays, mainDisplay } = useDisplays()
  const [itemIndex, setItemIndex] = useState(0)
  const [showLiveScreen, setShowLiveScreen] = useState(false)
  const [liveScreens, setLiveScreens] = useState<DisplayWithUsage[]>([])
  const [contentScreen, setContentScreen] = useState<ContentScreen | null>(null)
  const [windowsLiveScreenOpens, setWindowsLiveScreenOpens] = useState<number[]>([])
  const [liveScreensReady, setLiveScreensReady] = useState(false)

  useEffect(() => {
    if (!showLiveScreen && itemOnLive) {
      setShowLiveScreen(true)
    }
  }, [itemOnLive])

  useEffect(() => {
    // Detectar si las pantallas live han cambiado y asignarlas al state interno
    if (displays && displays.length > 0) {
      setLiveScreens(displays)
    } else {
      // Si no hay pantallas live configuradas, usar la principal como demo
      setLiveScreens(mainDisplay ? [mainDisplay] : [])
    }
  }, [displays])

  useEffect(() => {
    const fetchContentScreen = async () => {
      if (itemOnLive) {
        const screen = await getScheduleItemContentScreen(itemOnLive)
        setContentScreen(screen)
      } else {
        setContentScreen(null)
      }
    }
    fetchContentScreen()
  }, [itemOnLive])

  useEffect(() => {
    if (liveScreens.length > 0 && showLiveScreen) {
      // Mostrar contenido en pantallas live
      const showScreens = async () => {
        setLiveScreensReady(false)
        // Abrir todas las pantallas en paralelo
        const windowsIds = await Promise.all(
          liveScreens.map(async (display) => await window.displayAPI.showLiveScreen(display.id))
        )
        setLiveScreensReady(true)
        setWindowsLiveScreenOpens(windowsIds)
      }
      showScreens()
    } else if (!showLiveScreen) {
      // Cerrar ventanas live
      setLiveScreensReady(false)
      const closeScreens = async () => {
        await Promise.all(
          windowsLiveScreenOpens.map(
            async (windowId) => await window.displayAPI.closeLiveScreen(windowId)
          )
        )
        setWindowsLiveScreenOpens([])
      }
      closeScreens()
    }
  }, [showLiveScreen])

  //USEEFFECT QUE CONTROLA EL MANDO DE LAS PANTALLAS LIVE AL CAMBIAR EL ITEM ON LIVE
  useEffect(() => {
    // Solo enviar updates si las pantallas están listas y hay ventanas abiertas
    if (!liveScreensReady || windowsLiveScreenOpens.length === 0) {
      return
    }

    console.log('Sending content update to live screens')
    const sendUpdateToLiveScreens = async () => {
      await window.displayAPI.updateLiveScreenContent({
        itemIndex,
        contentScreen
      })
    }
    sendUpdateToLiveScreens()
  }, [itemIndex, itemOnLive, contentScreen, windowsLiveScreenOpens, liveScreensReady])

  useEffect(() => {
    // Solo enviar updates si las pantallas están listas y hay ventanas abiertas
    if (!liveScreensReady || windowsLiveScreenOpens.length === 0) {
      return
    }
    console.log('Sending theme update to live screens')
    const sendThemeToLiveScreens = async () => {
      await window.displayAPI.updateLiveScreenTheme(selectedTheme)
    }
    sendThemeToLiveScreens()
  }, [selectedTheme, showLiveScreen, windowsLiveScreenOpens, liveScreensReady])

  useEffect(() => {
    if (!showLiveScreen) return
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLiveScreen(false)
      }
    }
    addEventListener('keyup', handleKeyUp)
    return () => {
      removeEventListener('keyup', handleKeyUp)
    }
  }, [showLiveScreen])

  const showItemOnLiveScreen = async (item: ScheduleItem, index?: number) => {
    setItemOnLive(item)
    if (typeof index === 'number') {
      setItemIndex(index)
    }
  }
  return (
    <LiveContext.Provider
      value={{
        itemIndex,
        setItemIndex,
        itemOnLive,
        liveScreens,
        showLiveScreen,
        setShowLiveScreen,
        contentScreen,
        showItemOnLiveScreen,
        sendLiveMediaState,
        liveScreensReady
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
