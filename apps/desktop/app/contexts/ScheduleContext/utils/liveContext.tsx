import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'
import { ContentScreen, ILiveContext } from '../types'
import { useSchedule } from '..'
import { DisplayWithUsage, useDisplays } from '../../displayContext'
import type { ScheduleItem } from '@ecclesia/api'
import { BlankTheme } from '@/hooks/useThemes'
import { PresentationBibleOverrideMap } from '@/lib/presentationBibleVersionOverrides'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { resolveAppliedLiveTheme } from './resolveAppliedLiveTheme'
import { resolveSlideVerse } from '@/lib/presentationVerseController'
import { Api, onSocketReconnect } from '@ecclesia/queries'
import { useRemoteMode } from '../../RemoteModeContext'

// Extensión: stub para sincronización de media
type LiveMediaState = { action: 'play' | 'pause' | 'seek' | 'restart'; time: number }
const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children }: PropsWithChildren) => {
  const { isRemoteMode } = useRemoteMode()
  const { getScheduleItemContentScreen, itemOnLive, selectedTheme, setItemOnLive, currentSchedule, getScheduleItemLabel } = useSchedule()

  // Stub para sincronización de media (debe implementarse con IPC)
  const sendLiveMediaState = (state: LiveMediaState) => {
    if (isRemoteMode) return
    window.electron?.ipcRenderer?.send?.('live-media-state', state)
  }
  const { displays, mainDisplay } = useDisplays()
  const [socketReconnectKey, setSocketReconnectKey] = useState(0)

  useEffect(() => {
    return onSocketReconnect(() => setSocketReconnectKey((k) => k + 1))
  }, [])
  const [itemIndex, setItemIndex] = useState(0)
  const [appliedTheme, setAppliedTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [showLiveScreen, setShowLiveScreen] = useState(false)
  const [presentationVerseBySlideKey, setPresentationVerseBySlideKeyState] = useState<
    Record<string, number>
  >({})
  const [presentationBibleOverrideByKey, setPresentationBibleOverrideByKeyState] =
    useState<PresentationBibleOverrideMap>({})
  const [liveScreens, setLiveScreens] = useState<DisplayWithUsage[]>([])
  const [stageScreens, setStageScreens] = useState<DisplayWithUsage[]>([])
  const [contentScreen, setContentScreen] = useState<ContentScreen | null>(null)
  const [windowsLiveScreenOpens, setWindowsLiveScreenOpens] = useState<number[]>([])
  const [windowsStageScreenOpens, setWindowsStageScreenOpens] = useState<number[]>([])
  const [liveScreensReady, setLiveScreensReady] = useState(false)
  const [showedItemKey, setShowedItemKey] = useState(0)
  const [hideTextOnLive, setHideTextOnLive] = useState(false)
  const [showLogoOnLive, setShowLogoOnLive] = useState(false)
  const [blackScreenOnLive, setBlackScreenOnLive] = useState(false)

  // Refs para evitar closures stale en los callbacks de Socket.IO
  const currentScheduleRef = useRef(currentSchedule)
  currentScheduleRef.current = currentSchedule

  const showItemOnLiveScreenRef = useRef<(item: ScheduleItem, index?: number) => Promise<void>>(
    null as unknown as (item: ScheduleItem, index?: number) => Promise<void>
  )

  const contentScreenRef = useRef(contentScreen)
  contentScreenRef.current = contentScreen

  const navigateSlideRef = useRef<(direction: 'forward' | 'backward') => void>(() => {})

  navigateSlideRef.current = (direction: 'forward' | 'backward') => {
    if (!itemOnLive || !contentScreen?.content.length) return

    const slideCount = contentScreen.content.length
    const isForward = direction === 'forward'
    const isBackward = direction === 'backward'

    if (itemOnLive.type === 'PRESENTATION') {
      const safeIndex = Math.max(0, Math.min(itemIndex, slideCount - 1))
      const activeSlide = contentScreen.content[safeIndex]
      const verseController = resolveSlideVerse(
        activeSlide,
        safeIndex,
        presentationVerseBySlideKey
      )

      if (verseController) {
        if (isForward && verseController.current < verseController.end) {
          setPresentationVerseBySlideKeyState((prev) => ({
            ...prev,
            [verseController.slideKey]: verseController.current + 1
          }))
          return
        }

        if (isBackward && verseController.current > verseController.start) {
          setPresentationVerseBySlideKeyState((prev) => ({
            ...prev,
            [verseController.slideKey]: verseController.current - 1
          }))
          return
        }
      }
    }

    if (isBackward) {
      setItemIndex(Math.max(0, itemIndex - 1))
      return
    }

    if (isForward) {
      setItemIndex(Math.min(slideCount - 1, itemIndex + 1))
    }
  }

  const isRemoteModeRef = useRef(isRemoteMode)
  isRemoteModeRef.current = isRemoteMode

  const goToSlideRef = useRef<(index: number) => void>(() => {})

  goToSlideRef.current = (index: number) => {
    if (contentScreen?.content.length) {
      setItemIndex(Math.max(0, Math.min(index, contentScreen.content.length - 1)))
    }
  }

  // Escuchar comandos remotos vía Socket.IO
  useEffect(() => {
    const unsubSendToItem = Api.socket.listen.liveSendToItem(({ itemId }) => {
      const schedule = currentScheduleRef.current
      const item = schedule.find((i) => i.id === itemId)
      if (item) {
        showItemOnLiveScreenRef.current(item)
      }
    })

    const unsubClearItem = Api.socket.listen.liveClearItem(() => {
      setItemOnLive(null)
      setPresentationVerseBySlideKeyState({})
      setPresentationBibleOverrideByKeyState({})
      setItemIndex(0)
    })

    const unsubNextSlide = Api.socket.listen.liveNextSlide(() => {
      navigateSlideRef.current('forward')
    })

    const unsubPrevSlide = Api.socket.listen.livePrevSlide(() => {
      navigateSlideRef.current('backward')
    })

    const unsubGoToSlide = Api.socket.listen.liveGoToSlide(({ index }) => {
      goToSlideRef.current(index)
    })

    const unsubHideText = Api.socket.listen.liveSetHideText(({ active }) => {
      setHideTextOnLive(active)
    })

    const unsubShowLogo = Api.socket.listen.liveSetShowLogo(({ active }) => {
      if (active) setBlackScreenOnLive(false)
      setShowLogoOnLive(active)
    })

    const unsubBlackScreen = Api.socket.listen.liveSetBlackScreen(({ active }) => {
      if (active) setShowLogoOnLive(false)
      setBlackScreenOnLive(active)
    })

    // Aplicar liveStateUpdate solo en modo remoto (mirror del host)
    const unsubLiveState = Api.socket.listen.liveStateUpdate((state) => {
      if (!isRemoteModeRef.current) return

      if (state.itemOnLive) {
        const item = currentScheduleRef.current.find((i) => i.id === state.itemOnLive?.id)
        if (item) {
          showItemOnLiveScreenRef.current(item, state.itemIndex)
        } else {
          showItemOnLiveScreenRef.current(
            {
              id: state.itemOnLive.id,
              type: state.itemOnLive.type as any,
              accessData: state.itemOnLive.accessData,
              order: 0,
              scheduleId: -1,
              updatedAt: new Date(),
              deletedAt: null
            } as ScheduleItem,
            state.itemIndex
          )
        }
      } else {
        setItemOnLive(null)
        setPresentationVerseBySlideKeyState({})
        setPresentationBibleOverrideByKeyState({})
        setItemIndex(0)
      }
      setHideTextOnLive(state.hideTextOnLive)
      setShowLogoOnLive(state.showLogoOnLive)
      setBlackScreenOnLive(state.blackScreenOnLive)
      setShowLiveScreen(state.showLiveScreen)
    })

    return () => {
      unsubSendToItem()
      unsubClearItem()
      unsubNextSlide()
      unsubPrevSlide()
      unsubGoToSlide()
      unsubHideText()
      unsubShowLogo()
      unsubBlackScreen()
      unsubLiveState()
    }
  }, [socketReconnectKey])

  // Broadcast estado actual a clientes remotos cuando cambia
  // Se emite incluso cuando showLiveScreen es false para que los remotos
  // sepan que el host apagó la proyección.
  useEffect(() => {
    if (showLiveScreen) {
      const labelPromise = itemOnLive && !isRemoteMode
        ? getScheduleItemLabel(itemOnLive).then((l) => (typeof l === 'string' ? l : String(l)))
        : Promise.resolve(null)

      labelPromise.then((itemLabel) => {
        Api.socket.emit.liveStateUpdate({
          itemOnLive: itemOnLive
            ? { id: itemOnLive.id, type: itemOnLive.type, accessData: itemOnLive.accessData, label: itemLabel }
            : null,
          itemIndex,
          slideCount: contentScreen?.content.length ?? 0,
          hideTextOnLive,
          showLogoOnLive,
          blackScreenOnLive,
          showLiveScreen
        })
      })
    } else {
      Api.socket.emit.liveStateUpdate({
        itemOnLive: null,
        itemIndex: 0,
        slideCount: 0,
        hideTextOnLive: false,
        showLogoOnLive: false,
        blackScreenOnLive: false,
        showLiveScreen: false
      })
    }
  }, [
    showLiveScreen,
    itemOnLive,
    itemIndex,
    contentScreen?.content.length,
    hideTextOnLive,
    showLogoOnLive,
    blackScreenOnLive,
    socketReconnectKey,
    isRemoteMode,
    getScheduleItemLabel
  ])

  useEffect(() => {
    if (!showLiveScreen && itemOnLive) {
      setShowLiveScreen(true)
    }
  }, [itemOnLive])

  useEffect(() => {
    // Detectar si las pantallas live han cambiado y asignarlas al state interno
    if (displays && displays.length > 0) {
      setLiveScreens(displays.filter((display) => display.type === 'LIVE_SCREEN'))
      setStageScreens(displays.filter((display) => display.type === 'STAGE_SCREEN'))
    } else {
      // Si no hay pantallas live configuradas, usar la principal como demo
      setLiveScreens(mainDisplay ? [mainDisplay] : [])
      setStageScreens([])
    }
  }, [displays, mainDisplay])

  useEffect(() => {
    const fetchContentScreen = async () => {
      if (itemOnLive) {
        const screen = await getScheduleItemContentScreen(itemOnLive, {
          presentationBibleOverrideByKey
        })
        setContentScreen(screen)
      } else {
        setContentScreen(null)
      }
    }
    fetchContentScreen()
  }, [getScheduleItemContentScreen, itemOnLive, presentationBibleOverrideByKey])

  useEffect(() => {
    if (itemOnLive?.type === 'PRESENTATION') {
      return
    }

    setPresentationVerseBySlideKeyState({})
    setPresentationBibleOverrideByKeyState({})
  }, [itemOnLive?.accessData, itemOnLive?.type])

  useEffect(() => {
    if (isRemoteMode) return

    // Construir estado deseado: lista de displays con su tipo esperado
    const desiredScreens = [
      ...liveScreens.map((d) => ({ displayId: d.id, type: 'live' as const })),
      ...stageScreens.map((d) => ({ displayId: d.id, type: 'stage' as const }))
    ]

    // Si showLiveScreen es false, cerrar todas las ventanas
    if (!showLiveScreen) {
      if (windowsLiveScreenOpens.length === 0 && windowsStageScreenOpens.length === 0) {
        return
      }
      setLiveScreensReady(false)
      const closeScreens = async () => {
        await Promise.all(
          windowsLiveScreenOpens.map(
            async (windowId) => await window.displayAPI.closeLiveScreen(windowId)
          )
        )
        await Promise.all(
          windowsStageScreenOpens.map(
            async (windowId) => await window.displayAPI.closeStageScreen(windowId)
          )
        )
        setWindowsLiveScreenOpens([])
        setWindowsStageScreenOpens([])
      }
      closeScreens()
      return
    }

    // Si showLiveScreen es true, reconciliar pantallas
    if (desiredScreens.length === 0) {
      return
    }

    const reconcileScreens = async () => {
      const screenCountChanged =
        windowsLiveScreenOpens.length !== liveScreens.length ||
        windowsStageScreenOpens.length !== stageScreens.length

      if (
        screenCountChanged ||
        windowsLiveScreenOpens.length === 0 ||
        windowsStageScreenOpens.length === 0
      ) {
        // Si cambió la cantidad de pantallas o no hay ventanas abiertas aún, reconciliar completamente
        if (windowsLiveScreenOpens.length > 0 || windowsStageScreenOpens.length > 0) {
          // Cerrar todas las existentes primero
          setLiveScreensReady(false)
          await Promise.all(
            windowsLiveScreenOpens.map(
              async (windowId) => await window.displayAPI.closeLiveScreen(windowId)
            )
          )
          await Promise.all(
            windowsStageScreenOpens.map(
              async (windowId) => await window.displayAPI.closeStageScreen(windowId)
            )
          )
        }

        // Abrir el nuevo conjunto de pantallas
        setLiveScreensReady(false)
        const windowsLiveIds = await Promise.all(
          liveScreens.map(async (display) => await window.displayAPI.showLiveScreen(display.id))
        )
        const windowsStageIds = await Promise.all(
          stageScreens.map(async (display) => await window.displayAPI.showStageScreen(display.id))
        )
        setLiveScreensReady(true)
        setWindowsLiveScreenOpens(windowsLiveIds)
        setWindowsStageScreenOpens(windowsStageIds)
      }
    }

    reconcileScreens()
  }, [showLiveScreen, liveScreens, stageScreens, isRemoteMode])

  // Envia cambios de contenido/slide a live/stage.
  useEffect(() => {
    if (isRemoteMode) return
    console.log('Sending content update to live screens')
    const sendUpdateToLiveScreens = async () => {
      await window.displayAPI.updateLiveScreenContent({
        itemIndex,
        contentScreen,
        presentationVerseBySlideKey
      })
    }
    sendUpdateToLiveScreens()
  }, [
    itemIndex,
    itemOnLive,
    contentScreen,
    presentationVerseBySlideKey,
    windowsLiveScreenOpens,
    windowsStageScreenOpens,
    liveScreensReady,
    showedItemKey,
    isRemoteMode
  ])

  // Envia solo cambios de controles live para no invalidar/re-renderizar contenido multimedia.
  useEffect(() => {
    if (isRemoteMode) return
    if (!liveScreensReady || windowsLiveScreenOpens.length + windowsStageScreenOpens.length === 0) {
      return
    }

    console.log('Sending live controls update to live screens')
    const sendLiveControlsUpdate = async () => {
      await window.displayAPI.updateLiveScreenContent({
        liveControls: {
          hideText: hideTextOnLive,
          showLogo: showLogoOnLive,
          blackScreen: blackScreenOnLive
        }
      })
    }

    sendLiveControlsUpdate()
  }, [
    hideTextOnLive,
    showLogoOnLive,
    blackScreenOnLive,
    windowsLiveScreenOpens,
    windowsStageScreenOpens,
    liveScreensReady,
    showedItemKey,
    isRemoteMode
  ])

  useEffect(() => {
    if (isRemoteMode) return
    const unsuscribe = window.electron.ipcRenderer.on('all-screens-closed', () => {
      setShowLiveScreen(false)
      setWindowsLiveScreenOpens([])
      setWindowsStageScreenOpens([])
    })
    return unsuscribe
  }, [isRemoteMode])

  useEffect(() => {
    if (isRemoteMode) return
    console.log('Sending theme update to live screens')
    const sendThemeToLiveScreens = async () => {
      await window.displayAPI.updateLiveScreenTheme(appliedTheme)
    }
    sendThemeToLiveScreens()
  }, [
    showLiveScreen,
    windowsLiveScreenOpens,
    windowsStageScreenOpens,
    liveScreensReady,
    showedItemKey,
    itemOnLive,
    appliedTheme,
    isRemoteMode
  ])

  useEffect(() => {
    if (isRemoteMode) return
    const handleKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName?.toLowerCase()
        const isEditableField =
          target.isContentEditable || tagName === 'input' || tagName === 'textarea'
        if (isEditableField) return
      }

      if (event.key === 'F7') {
        event.preventDefault()
        setShowLiveScreen((prev) => !prev)
        return
      }

      if (!showLiveScreen) return

      if (event.key === 'F9') {
        event.preventDefault()
        setHideTextOnLive((prev) => !prev)
        return
      }

      if (event.key === 'F10') {
        event.preventDefault()
        setShowLogoOnLive((prev) => {
          const next = !prev
          if (next) {
            setBlackScreenOnLive(false)
          }
          return next
        })
        return
      }

      if (event.key === 'F11') {
        event.preventDefault()
        setBlackScreenOnLive((prev) => {
          const next = !prev
          if (next) {
            setShowLogoOnLive(false)
          }
          return next
        })
        return
      }

      if (event.key === 'Escape' && itemOnLive) {
        setItemOnLive(null)
        setPresentationVerseBySlideKeyState({})
        setPresentationBibleOverrideByKeyState({})
        setItemIndex(0)
      }
    }

    addEventListener('keyup', handleKeyUp)
    return () => {
      removeEventListener('keyup', handleKeyUp)
    }
  }, [showLiveScreen, itemOnLive, setItemOnLive, isRemoteMode])

  const showItemOnLiveScreen = async (item: ScheduleItem, index?: number) => {
    setItemOnLive({ ...item })
    setAppliedTheme(resolveAppliedLiveTheme(item, selectedTheme))
    setPresentationVerseBySlideKeyState({})
    setPresentationBibleOverrideByKeyState({})
    setItemIndex(typeof index === 'number' ? index : 0)
    setShowedItemKey((prev) => prev + 1)
  }
  showItemOnLiveScreenRef.current = showItemOnLiveScreen

  const setPresentationVerseBySlideKey: ILiveContext['setPresentationVerseBySlideKey'] = (
    updater
  ) => {
    setPresentationVerseBySlideKeyState((previous) =>
      typeof updater === 'function' ? updater(previous) : updater
    )
  }

  const setPresentationBibleOverrideByKey: ILiveContext['setPresentationBibleOverrideByKey'] = (
    updater
  ) => {
    setPresentationBibleOverrideByKeyState((previous) =>
      typeof updater === 'function' ? updater(previous) : updater
    )
  }

  return (
    <LiveContext.Provider
      value={{
        itemIndex,
        setItemIndex,
        liveContentVersion: showedItemKey,
        appliedTheme,
        presentationVerseBySlideKey,
        setPresentationVerseBySlideKey,
        presentationBibleOverrideByKey,
        setPresentationBibleOverrideByKey,
        itemOnLive,
        liveScreens,
        stageScreens,
        showLiveScreen,
        setShowLiveScreen,
        contentScreen,
        showItemOnLiveScreen,
        sendLiveMediaState,
        liveScreensReady,
        hideTextOnLive,
        showLogoOnLive,
        blackScreenOnLive,
        setHideTextOnLive,
        setShowLogoOnLive,
        setBlackScreenOnLive
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
