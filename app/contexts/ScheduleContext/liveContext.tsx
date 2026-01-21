import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { ContentScreen, ILiveContext } from './types'
import { useSchedule } from '.'
import { DisplayWithUsage, useDisplays } from '../displayContext'
import { ScheduleItem } from '@prisma/client'

const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children }: PropsWithChildren) => {
  const { getScheduleItemContentScreen, itemOnLive, selectedTheme, setItemOnLive } = useSchedule()
  const { displays, mainDisplay } = useDisplays()
  const [itemIndex, setItemIndex] = useState(0)
  const [showLiveScreen, setShowLiveScreen] = useState(false)
  const [liveScreens, setLiveScreens] = useState<DisplayWithUsage[]>([])
  const [contentScreen, setContentScreen] = useState<ContentScreen | null>(null)
  const [windowsLiveScreenOpens, setWindowsLiveScreenOpens] = useState<number[]>([])
  const [liveScreensReady, setLiveScreensReady] = useState(false)
  const [readyScreensCount, setReadyScreensCount] = useState(0)

  useEffect(() => {
    if (!showLiveScreen && itemOnLive) {
      setShowLiveScreen(true)
    }
  }, [itemOnLive])

  useEffect(() => {
    // Listener para eventos de ventanas live listas
    const handleLiveScreenReady = (windowId: number) => {
      console.log(`Live screen ${windowId} is ready`)
      setReadyScreensCount((prev) => {
        const newCount = prev + 1
        // Si todas las ventanas están listas, establecer liveScreensReady a true
        if (newCount >= windowsLiveScreenOpens.length && windowsLiveScreenOpens.length > 0) {
          console.log('All live screens are ready!')
          setLiveScreensReady(true)
        }
        return newCount
      })
    }

    const unsubscribe = window.electron.ipcRenderer.on('live-screen-ready', (_, windowId) => {
      handleLiveScreenReady(windowId)
    })

    const unsuscribeHideLiveScreen = window.electron.ipcRenderer.on('liveScreen-hide', () => {
      setShowLiveScreen(false)
    })
    return () => {
      unsubscribe()
      unsuscribeHideLiveScreen()
    }
  }, [windowsLiveScreenOpens.length])

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
      // Mostrar contenidfo en pantallas live
      const showScreens = async () => {
        setLiveScreensReady(false)
        setReadyScreensCount(0)
        const windowsIds: number[] = []

        console.log(`Opening ${liveScreens.length} live screens...`)
        for (const display of liveScreens) {
          const windowId = await window.displayAPI.showLiveScreen(display.id)
          windowsIds.push(windowId)
        }

        setWindowsLiveScreenOpens(windowsIds)

        // Timeout como fallback en caso de que algún evento no llegue
        const fallbackTimeout = setTimeout(() => {
          console.log('Fallback: Setting live screens as ready after timeout')
          setLiveScreensReady(true)
        }, 5000) // 5 segundos como fallback

        // Limpiar el timeout si todas las ventanas responden antes
        const checkAllReady = setInterval(() => {
          if (readyScreensCount >= windowsIds.length) {
            clearTimeout(fallbackTimeout)
            clearInterval(checkAllReady)
          }
        }, 100)
      }
      showScreens()
    } else if (!showLiveScreen) {
      // Cerrar ventanas live
      setLiveScreensReady(false)
      setReadyScreensCount(0)
      const closeScreens = async () => {
        for (const windowId of windowsLiveScreenOpens) {
          await window.displayAPI.closeLiveScreen(windowId)
        }
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

    const sendUpdateToLiveScreens = async () => {
      console.log('Sending content update to live screens')
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
        showItemOnLiveScreen
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
