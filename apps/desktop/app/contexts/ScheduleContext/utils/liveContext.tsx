import { Api } from '@ecclesia/queries'
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'
import { ContentScreen, ILiveContext } from '../types'
import { useSchedule } from '..'
import { DisplayWithUsage, useDisplays } from '../../displayContext'
import type { ScheduleItem } from '@ecclesia/api'
import { BlankTheme } from '@/hooks/useThemes'
import { PresentationBibleOverrideMap } from '@/lib/presentationBibleVersionOverrides'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { resolveAppliedLiveTheme } from './resolveAppliedLiveTheme'
import { platformBridge } from '@/lib/platformBridge'

// Extensión: stub para sincronización de media
type LiveMediaState = { action: 'play' | 'pause' | 'seek' | 'restart'; time: number; volume?: number }
const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children }: PropsWithChildren) => {
  // Envía comando de media vía Socket.IO para sincronizar todas las pantallas
  const sendLiveMediaState = (state: LiveMediaState) => {
    Api.socket.emit.liveMediaState(state)
  }
  const { getScheduleItemContentScreen, itemOnLive, selectedTheme, setItemOnLive } = useSchedule()
  const { displays, mainDisplay } = useDisplays()
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

  // Ref para mantener la referencia más reciente del contenido a enviar
  const latestContentRef = useRef<{
    itemIndex: number
    contentScreen: ContentScreen | null
    presentationVerseBySlideKey: Record<string, number>
    liveControls: { hideText: boolean; showLogo: boolean; blackScreen: boolean }
    theme: ThemeWithMedia | null
  }>({
    itemIndex: 0,
    contentScreen: null,
    presentationVerseBySlideKey: {},
    liveControls: { hideText: false, showLogo: false, blackScreen: false },
    theme: null
  })

  // Escuchar renderer-ready desde las ventanas live/stage para reenviar contenido
  useEffect(() => {
    const unlisten = platformBridge.ipcRenderer.on('renderer-ready', () => {
      const latest = latestContentRef.current
      window.displayAPI.updateLiveScreenContent({
        itemIndex: latest.itemIndex,
        contentScreen: latest.contentScreen,
        presentationVerseBySlideKey: latest.presentationVerseBySlideKey
      })
      window.displayAPI.updateLiveScreenContent({
        liveControls: latest.liveControls
      })
      if (latest.theme) {
        window.displayAPI.updateLiveScreenTheme(latest.theme)
      }
    })
    return () => { unlisten() }
  }, [])

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
      const desiredLiveIds = liveScreens.map((d) => d.id)
      const desiredStageIds = stageScreens.map((d) => d.id)
      const liveIdsChanged =
        windowsLiveScreenOpens.length !== desiredLiveIds.length ||
        windowsLiveScreenOpens.some((id, i) => id !== desiredLiveIds[i])
      const stageIdsChanged =
        windowsStageScreenOpens.length !== desiredStageIds.length ||
        windowsStageScreenOpens.some((id, i) => id !== desiredStageIds[i])

      const needsReconcile =
        liveIdsChanged ||
        stageIdsChanged ||
        windowsLiveScreenOpens.length === 0 ||
        windowsStageScreenOpens.length === 0

      if (needsReconcile) {
        // Si cambió el conjunto de pantallas o no hay ventanas abiertas aún, reconciliar completamente
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
  }, [showLiveScreen, liveScreens, stageScreens])

  useEffect(() => {
    if (!liveScreensReady || windowsLiveScreenOpens.length + windowsStageScreenOpens.length === 0) {
      return
    }

    const sendUpdateToLiveScreens = async () => {
      latestContentRef.current = {
        ...latestContentRef.current,
        itemIndex,
        contentScreen,
        presentationVerseBySlideKey
      }
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
    showedItemKey
  ])

  // Envia solo cambios de controles live para no invalidar/re-renderizar contenido multimedia.
  useEffect(() => {
    if (!liveScreensReady || windowsLiveScreenOpens.length + windowsStageScreenOpens.length === 0) {
      return
    }

    const sendLiveControlsUpdate = async () => {
      const controls = {
        hideText: hideTextOnLive,
        showLogo: showLogoOnLive,
        blackScreen: blackScreenOnLive
      }
      latestContentRef.current = {
        ...latestContentRef.current,
        liveControls: controls
      }
      await window.displayAPI.updateLiveScreenContent({
        liveControls: controls
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
    showedItemKey
  ])

  useEffect(() => {
    const unsuscribe = platformBridge.ipcRenderer.on('all-screens-closed', () => {
      setShowLiveScreen(false)
      setWindowsLiveScreenOpens([])
      setWindowsStageScreenOpens([])
    })
    return unsuscribe
  }, [])

  useEffect(() => {
    // Solo enviar updates si las pantallas están listas y hay ventanas abiertas
    // no mandar si el tema cambio, solo mandar el cambio de tema al reeniviar otro item
    if (!liveScreensReady || windowsLiveScreenOpens.length + windowsStageScreenOpens.length === 0) {
      return
    }

    const sendThemeToLiveScreens = async () => {
      latestContentRef.current = {
        ...latestContentRef.current,
        theme: appliedTheme
      }
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
    appliedTheme
  ])

  useEffect(() => {
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
  }, [showLiveScreen, itemOnLive, setItemOnLive])

  const showItemOnLiveScreen = async (item: ScheduleItem, index?: number) => {
    setItemOnLive({ ...item })
    setAppliedTheme(resolveAppliedLiveTheme(item, selectedTheme))
    setPresentationVerseBySlideKeyState({})
    setPresentationBibleOverrideByKeyState({})
    setItemIndex(typeof index === 'number' ? index : 0)
    setShowedItemKey((prev) => prev + 1)
  }

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
