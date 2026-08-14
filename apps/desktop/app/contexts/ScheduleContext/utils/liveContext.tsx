import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ContentScreen, ILiveContext } from '../types'
import { useSchedule } from '..'
import { DisplayWithUsage, useDisplays } from '../../displayContext'
import type { ScheduleItem } from '@ecclesia/api'
import { BlankTheme, useThemes } from '@/hooks/useThemes'
import { PresentationBibleOverrideMap } from '@/lib/presentationBibleVersionOverrides'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { resolveAppliedLiveTheme } from './resolveAppliedLiveTheme'
import { resolveSlideVerse } from '@/lib/presentationVerseController'
import { extractOverlayText, extractOverlayReference } from '@/lib/presentationOverlayText'
import { resolvePresentationBookShortName } from '@/lib/presentationBibleBadge'
import useBibleSchema from '@/hooks/useBibleSchema'
import { Api, onSocketReconnect } from '@ecclesia/queries'
import { useRemoteMode } from '../../RemoteModeContext'

// Extensión: stub para sincronización de media
type LiveMediaState = { action: 'play' | 'pause' | 'seek' | 'restart'; time: number }
const LiveContext = createContext({} as ILiveContext)

export const LiveProvider = ({ children }: PropsWithChildren) => {
  const { isRemoteMode } = useRemoteMode()
  const { getScheduleItemContentScreen, itemOnLive, selectedTheme, setItemOnLive, currentSchedule, songs, media, presentations } = useSchedule()
  const { themes } = useThemes()
  const { bibleSchema } = useBibleSchema()

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

  // Flag para evitar que el broadcast effect re-emita cambios recibidos vía Socket.IO
  const isApplyingRemoteUpdate = useRef(false)

  // Refs para evitar closures stale en los callbacks de Socket.IO
  const currentScheduleRef = useRef(currentSchedule)
  currentScheduleRef.current = currentSchedule

  const themesRef = useRef(themes)
  themesRef.current = themes

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

    // Apagar/encender la proyección solo se acepta por este comando explícito, nunca
    // deducido de `liveStateUpdate`: así el botón «En Vivo» del remoto sigue apagando
    // el host, pero su ciclo de vida (arranque/cierre) ya no lo hace.
    const unsubShowLiveScreen = Api.socket.listen.liveSetShowLiveScreen(({ active }) => {
      setShowLiveScreen(active)
    })

    // Aplicar liveStateUpdate desde remotos (broadcast socket.io excluye al sender)
    const unsubLiveState = Api.socket.listen.liveStateUpdate((state) => {
      isApplyingRemoteUpdate.current = true
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
        // Override appliedTheme with the remote's themeId
        if (state.themeId != null) {
          const remoteTheme = themesRef.current.find((t) => t.id === state.themeId)
          if (remoteTheme) {
            setAppliedTheme(remoteTheme)
          }
        }
      } else {
        setItemOnLive(null)
        setPresentationVerseBySlideKeyState({})
        setPresentationBibleOverrideByKeyState({})
        setItemIndex(0)
        // Also sync themeId when clearing live
        if (state.themeId != null) {
          const remoteTheme = themesRef.current.find((t) => t.id === state.themeId)
          if (remoteTheme) {
            setAppliedTheme(remoteTheme)
          }
        }
      }
      setHideTextOnLive(state.hideTextOnLive)
      setShowLogoOnLive(state.showLogoOnLive)
      setBlackScreenOnLive(state.blackScreenOnLive)
      // El cliente remoto espeja la proyección del host; el host, en cambio, solo acepta
      // que un remoto la ENCIENDA. Un remoto no puede apagarla (F7 está deshabilitado en
      // remoto), así que un `showLiveScreen: false` suyo es estado inicial o eco obsoleto:
      // obedecerlo cerraba las pantallas en vivo del host al cerrarse la app cliente.
      if (isRemoteModeRef.current) {
        setShowLiveScreen(state.showLiveScreen)
      } else if (state.showLiveScreen) {
        setShowLiveScreen(true)
      }
      // Solo el cliente remoto sobreescribe sus pantallas con las del host;
      // el host nunca debe reemplazar sus displays locales con datos del cliente.
      if (isRemoteModeRef.current) {
        if (state.liveScreens) {
          setLiveScreens(state.liveScreens as DisplayWithUsage[])
        }
        if (state.stageScreens) {
          setStageScreens(state.stageScreens as DisplayWithUsage[])
        }
      }
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
      unsubShowLiveScreen()
      unsubLiveState()
    }
  }, [socketReconnectKey])

  // Label reactivo del item en vivo (se actualiza cuando cambian songs/media/presentations)
  const itemOnLiveLabel = useMemo(() => {
    if (!itemOnLive) return null
    switch (itemOnLive.type) {
      case 'SONG': {
        const song = songs.find((s) => s.id === parseInt(itemOnLive.accessData))
        return song?.title ?? null
      }
      case 'MEDIA': {
        const med = media.find((m) => m.id === parseInt(itemOnLive.accessData))
        return med?.name ?? null
      }
      case 'PRESENTATION': {
        const p = presentations.find((p) => p.id === parseInt(itemOnLive.accessData))
        return p?.title ?? null
      }
      default:
        return null
    }
  }, [itemOnLive, songs, media, presentations])

  // Texto plano + referencia bíblica actualmente en vivo, para OBS.
  // Requiere `showLiveScreen`: sin proyección en vivo el overlay no muestra nada.
  // Vacío también con TIMER, si el slide es medio, o si el texto está oculto/negro/logo.
  const obsOverlayPayload = useMemo(() => {
    if (!showLiveScreen || !itemOnLive) return { text: '', reference: '', contentType: '' }
    if (itemOnLive.type === 'TIMER') return { text: '', reference: '', contentType: '' }
    if (hideTextOnLive || blackScreenOnLive || showLogoOnLive)
      return { text: '', reference: '', contentType: '' }
    const slide = contentScreen?.content?.[itemIndex]
    return {
      text: extractOverlayText(slide, itemIndex, presentationVerseBySlideKey),
      reference: extractOverlayReference(slide, itemIndex, presentationVerseBySlideKey, (bookId) =>
        resolvePresentationBookShortName(bookId, bibleSchema)
      ),
      contentType: itemOnLive.type
    }
  }, [
    showLiveScreen,
    itemOnLive,
    hideTextOnLive,
    blackScreenOnLive,
    showLogoOnLive,
    contentScreen,
    itemIndex,
    presentationVerseBySlideKey,
    bibleSchema
  ])

  const obsOverlayPayloadRef = useRef(obsOverlayPayload)
  obsOverlayPayloadRef.current = obsOverlayPayload
  const lastEmittedObsRef = useRef<string | null>(null)
  const prevShowLiveForObsRef = useRef(showLiveScreen)

  // Emitir texto + referencia a la página /obs cuando cambian (solo el host proyecta).
  // Al (re)activarse la proyección se fuerza el envío aunque el texto coincida con el
  // último emitido, para refrescar páginas /obs con estado obsoleto.
  useEffect(() => {
    if (isRemoteMode) return
    const becameLive = showLiveScreen && !prevShowLiveForObsRef.current
    prevShowLiveForObsRef.current = showLiveScreen
    const signature = `${obsOverlayPayload.text} ${obsOverlayPayload.reference}`
    if (!becameLive && lastEmittedObsRef.current === signature) return
    lastEmittedObsRef.current = signature
    Api.socket.emit.obsTextUpdate(obsOverlayPayload)
  }, [obsOverlayPayload, showLiveScreen, isRemoteMode])

  // La página /obs pide el estado actual al conectar (late join).
  useEffect(() => {
    if (isRemoteMode) return
    return Api.socket.listen.requestObsText(() => {
      Api.socket.emit.obsTextUpdate(obsOverlayPayloadRef.current)
    })
  }, [isRemoteMode, socketReconnectKey])

  // Broadcast estado actual a clientes remotos cuando cambia
  // Se emite incluso cuando showLiveScreen es false para que los remotos
  // sepan que el host apagó la proyección.
  // Solo se omite cuando el cambio proviene de recibir un liveStateUpdate
  // (evita el ping-pong infinito entre host y cliente remoto).
  useEffect(() => {
    if (isRemoteMode && isApplyingRemoteUpdate.current) {
      isApplyingRemoteUpdate.current = false
      return
    }

    if (showLiveScreen) {
      const itemLabel =
        itemOnLive && !isRemoteMode ? (itemOnLiveLabel ?? itemOnLive.accessData) : null

      Api.socket.emit.liveStateUpdate({
        itemOnLive: itemOnLive
          ? { id: itemOnLive.id, type: itemOnLive.type, accessData: itemOnLive.accessData, label: itemLabel }
          : null,
          itemIndex,
          slideCount: contentScreen?.content.length ?? 0,
          hideTextOnLive,
          showLogoOnLive,
          blackScreenOnLive,
          showLiveScreen,
          themeId: appliedTheme.id,
          liveScreens: liveScreens.map((s) => ({
            id: s.id,
            label: s.label,
            type: s.type,
            aspectRatioCss: s.aspectRatioCss
          })),
          stageScreens: stageScreens.map((s) => ({
            id: s.id,
            label: s.label,
            type: s.type,
            aspectRatioCss: s.aspectRatioCss
          }))
        })
    } else if (!isRemoteMode) {
      // Solo el host anuncia que apagó la proyección. En un cliente remoto
      // `showLiveScreen: false` nunca es una orden del operador: es el estado inicial
      // (aún no llegó el broadcast del host) o un eco del propio host. Emitirlo hacía
      // que el host cerrara sus pantallas en vivo por el ciclo de vida del cliente.
      Api.socket.emit.liveStateUpdate({
        itemOnLive: null,
        itemIndex: 0,
        slideCount: 0,
        hideTextOnLive: false,
        showLogoOnLive: false,
        blackScreenOnLive: false,
        showLiveScreen: false,
        themeId: null,
        liveScreens: [],
        stageScreens: []
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
    liveScreens,
    stageScreens,
    appliedTheme,
    socketReconnectKey,
    isRemoteMode,
    itemOnLiveLabel
  ])

  useEffect(() => {
    if (!showLiveScreen && itemOnLive) {
      setShowLiveScreen(true)
    }
  }, [itemOnLive])

  useEffect(() => {
    // En modo remoto, las pantallas vienen del broadcast Socket.IO
    if (isRemoteMode) return

    // Detectar si las pantallas live han cambiado y asignarlas al state interno
    if (displays && displays.length > 0) {
      setLiveScreens(displays.filter((display) => display.type === 'LIVE_SCREEN'))
      setStageScreens(displays.filter((display) => display.type === 'STAGE_SCREEN'))
    } else {
      // Si no hay pantallas live configuradas, usar la principal como demo
      setLiveScreens(mainDisplay ? [mainDisplay] : [])
      setStageScreens([])
    }
  }, [displays, mainDisplay, isRemoteMode])

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
  // Solo incluye contentScreen cuando realmente cambio (referencia distinta),
  // asi las ventanas live no reciben contenido redundante al navegar slides.
  const lastContentRef = useRef<ContentScreen | null | '__unset__'>('__unset__')
  const prevLiveScreensReadyRef = useRef(false)
  useEffect(() => {
    if (isRemoteMode) return

    const screensJustBecameReady = !prevLiveScreensReadyRef.current && liveScreensReady
    prevLiveScreensReadyRef.current = liveScreensReady

    const contentChanged = contentScreen !== lastContentRef.current
    if (contentChanged) {
      lastContentRef.current = contentScreen
    }

    // Cuando las pantallas se ponen ready por primera vez o cambia el contenido,
    // reenviar el estado completo para pantallas que se conectaron tarde
    if (screensJustBecameReady) {
      window.displayAPI.updateLiveScreenContent({
        itemIndex,
        contentScreen,
        presentationVerseBySlideKey
      })
      return
    }

    if (contentChanged) {
      window.displayAPI.updateLiveScreenContent({
        itemIndex,
        contentScreen,
        presentationVerseBySlideKey
      })
    } else {
      window.displayAPI.updateLiveScreenContent({
        itemIndex,
        presentationVerseBySlideKey
      })
    }
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
    setAppliedTheme(resolveAppliedLiveTheme(item, selectedTheme, themes))
    setPresentationVerseBySlideKeyState({})
    setPresentationBibleOverrideByKeyState({})
    setItemIndex(typeof index === 'number' ? index : 0)
    setShowedItemKey((prev) => prev + 1)
  }
  showItemOnLiveScreenRef.current = showItemOnLiveScreen

  // Toggle «En Vivo» del operador. Desde un cliente remoto viaja como comando explícito:
  // el estado espejado (`liveStateUpdate`) no puede apagar el host, porque no distingue
  // una orden real de un eco de su ciclo de vida.
  const requestShowLiveScreen: ILiveContext['setShowLiveScreen'] = (show) => {
    setShowLiveScreen(show)
    if (isRemoteMode) {
      Api.socket.emit.liveSetShowLiveScreen({ active: show })
    }
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
        setShowLiveScreen: requestShowLiveScreen,
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
