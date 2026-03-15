import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { PresentationView } from '@/ui/PresentationView'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'
import { DEFAULT_STAGE_LAYOUT, StageLayout, parseStageLayout } from '../stage/shared/layout'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { FocusModeOverlay } from './FocusModeOverlay'
import { StageWidgets } from './StageWidgets'
import { DEFAULT_STATE, StageState } from './types'
import { MAX_STAGE_TIMERS, formatRemaining, resolveRemainingMs } from './utils'

type StageScreenProps = {
  isPreview?: boolean
  previewDisplayId?: number
}

type StageScreenConfigUpdate = {
  selectedScreenId: number
}

export default function StageScreen({ isPreview = false, previewDisplayId }: StageScreenProps) {
  const displayIdParam = useParams().displayId
  const routeDisplayId = displayIdParam ? parseInt(displayIdParam, 10) : undefined
  const displayId = isPreview ? previewDisplayId : routeDisplayId

  const [itemIndex, setItemIndex] = useState(0)
  const [content, setContent] = useState<ContentScreen | null>(null)
  const [presentationVerseBySlideKey, setPresentationVerseBySlideKey] = useState<
    Record<string, number>
  >({})

  const [stageTheme, setStageTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [liveTheme, setLiveTheme] = useState<ThemeWithMedia>(BlankTheme)
  const [layout, setLayout] = useState<StageLayout>(DEFAULT_STAGE_LAYOUT)
  const [stageState, setStageState] = useState<StageState>(DEFAULT_STATE)
  const [themeTransitionKey, setThemeTransitionKey] = useState(0)
  const selectedScreenIdRef = useRef<number | null>(null)
  const themeMarkerRef = useRef<string | null>(null)
  const configuredThemeIdRef = useRef<number | null>(null)
  const stageScreenSize = useScreenSize(100, displayId)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState(() => ({ width: 1280, height: 720 }))

  const hasConfiguredThemeRef = useRef(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const applyTheme = useCallback((theme: ThemeWithMedia, marker: string) => {
    setStageTheme((previous) => {
      if (
        previous.id === theme.id &&
        String(previous.updatedAt) === String(theme.updatedAt) &&
        previous.background === theme.background &&
        previous.backgroundMediaId === theme.backgroundMediaId
      ) {
        return previous
      }

      return theme
    })

    if (themeMarkerRef.current !== marker) {
      themeMarkerRef.current = marker
      setThemeTransitionKey((prev) => prev + 1)
      return
    }

    themeMarkerRef.current = marker
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return

    const syncContainerSize = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      setContainerSize({
        width: rect.width,
        height: rect.height
      })
    }

    syncContainerSize()

    const observer = new ResizeObserver(() => {
      syncContainerSize()
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!displayId) return

    const loadStageConfig = async () => {
      const selectedScreen = await window.api.selectedScreens.getSelectedScreenByScreenId(displayId)

      if (!selectedScreen || selectedScreen.rol !== 'STAGE_SCREEN') {
        selectedScreenIdRef.current = null
        hasConfiguredThemeRef.current = false
        setLayout(DEFAULT_STAGE_LAYOUT)
        setStageState(DEFAULT_STATE)
        applyTheme(BlankTheme, 'none')
        return
      }

      selectedScreenIdRef.current = selectedScreen.id

      const config = await window.api.stageScreenConfig.getStageScreenConfigBySelectedScreenId(
        selectedScreen.id
      )

      if (!config) {
        configuredThemeIdRef.current = null
        hasConfiguredThemeRef.current = false
        setLayout(DEFAULT_STAGE_LAYOUT)
        setStageState(DEFAULT_STATE)
        applyTheme(liveTheme, `live:${liveTheme.id}`)
        return
      }

      setLayout(parseStageLayout(config.layout))
      setStageState(parseState(config.state))

      if (config.themeId) {
        if (configuredThemeIdRef.current === config.themeId) {
          hasConfiguredThemeRef.current = true
          return
        }

        const configuredTheme = await window.api.themes.getThemeById(config.themeId)
        configuredThemeIdRef.current = config.themeId
        hasConfiguredThemeRef.current = true
        applyTheme(configuredTheme, `configured:${configuredTheme.id}`)
      } else {
        configuredThemeIdRef.current = null
        hasConfiguredThemeRef.current = false
        applyTheme(liveTheme, `live:${liveTheme.id}`)
      }
    }

    loadStageConfig()
  }, [applyTheme, displayId, liveTheme])

  useEffect(() => {
    window.electron.ipcRenderer.send('renderer-ready')

    const unsubscribeItems = window.electron.ipcRenderer.on(
      'liveScreen-update',
      (_, data: ScreenContentUpdate) => {
        if (typeof data.itemIndex === 'number') {
          setItemIndex(data.itemIndex)
        }

        if ('contentScreen' in data) {
          setContent(data.contentScreen ?? null)
        }

        if (data.presentationVerseBySlideKey !== undefined) {
          setPresentationVerseBySlideKey(data.presentationVerseBySlideKey)
        }
      }
    )

    const unsubscribeTheme = window.electron.ipcRenderer.on(
      'liveScreen-update-theme',
      (_, theme: ThemeWithMedia) => {
        setLiveTheme(theme)

        if (!hasConfiguredThemeRef.current) {
          applyTheme(theme, `live:${theme.id}`)
        }
      }
    )

    const unsubscribeStageConfig = window.electron.ipcRenderer.on(
      'stageScreen-config-updated',
      async (_, data: StageScreenConfigUpdate) => {
        if (selectedScreenIdRef.current !== data.selectedScreenId) return

        const config = await window.api.stageScreenConfig.getStageScreenConfigBySelectedScreenId(
          data.selectedScreenId
        )

        if (!config) {
          setLayout(DEFAULT_STAGE_LAYOUT)
          setStageState(DEFAULT_STATE)
          configuredThemeIdRef.current = null
          hasConfiguredThemeRef.current = false
          applyTheme(liveTheme, `live:${liveTheme.id}`)
          return
        }

        setLayout(parseStageLayout(config.layout))
        setStageState(parseState(config.state))

        if (config.themeId) {
          if (configuredThemeIdRef.current === config.themeId) {
            hasConfiguredThemeRef.current = true
            return
          }

          const configuredTheme = await window.api.themes.getThemeById(config.themeId)
          configuredThemeIdRef.current = config.themeId
          hasConfiguredThemeRef.current = true
          applyTheme(configuredTheme, `configured:${configuredTheme.id}`)
        } else {
          configuredThemeIdRef.current = null
          hasConfiguredThemeRef.current = false
          applyTheme(liveTheme, `live:${liveTheme.id}`)
        }
      }
    )

    return () => {
      unsubscribeItems()
      unsubscribeTheme()
      unsubscribeStageConfig()
    }
  }, [applyTheme, liveTheme])

  const resolvedTimers = useMemo(() => {
    return (stageState.timers ?? []).slice(0, MAX_STAGE_TIMERS).map((timer, index) => {
      const remainingMs = resolveRemainingMs(timer, nowMs)
      return {
        key: String(timer.id ?? index),
        label: timer.label?.trim() || `Timer ${index + 1}`,
        remainingMs,
        value: formatRemaining(remainingMs)
      }
    })
  }, [stageState.timers, nowMs])

  const sortedWidgets = useMemo(() => {
    return [...layout.items].filter((item) => item.visible).sort((a, b) => a.z - b.z)
  }, [layout.items])

  const hasLiveScreenWidget = useMemo(() => {
    return sortedWidgets.some((item) => item.type === 'liveScreen')
  }, [sortedWidgets])

  const liveTitle = content?.title ?? ''
  const focusMode = Boolean(stageState.focusMode)
  const hasFocusContent =
    sortedWidgets.some((w) => w.type === 'clock') ||
    (resolvedTimers.length > 0 && sortedWidgets.some((w) => w.type === 'timers')) ||
    (Boolean(stageState.message) && sortedWidgets.some((w) => w.type === 'message'))

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-black text-white">
      {!hasLiveScreenWidget ? (
        <div className="absolute inset-0 z-0">
          <PresentationView
            items={content?.content || []}
            theme={stageTheme}
            currentIndex={itemIndex}
            themeTransitionKey={themeTransitionKey}
            presentationVerseBySlideKey={presentationVerseBySlideKey}
            live
            displayId={displayId}
          />
        </div>
      ) : null}

      <StageWidgets
        sortedWidgets={sortedWidgets}
        stageState={stageState}
        resolvedTimers={resolvedTimers}
        containerSize={containerSize}
        nowMs={nowMs}
        isPreview={isPreview}
        content={content}
        stageTheme={stageTheme}
        itemIndex={itemIndex}
        themeTransitionKey={themeTransitionKey}
        presentationVerseBySlideKey={presentationVerseBySlideKey}
        displayId={displayId}
        stageAspectRatio={stageScreenSize.aspectRatio ?? '16 / 9'}
        liveTitle={liveTitle}
      />

      {focusMode && hasFocusContent ? (
        <FocusModeOverlay
          stageState={stageState}
          sortedWidgets={sortedWidgets}
          resolvedTimers={resolvedTimers}
          containerSize={containerSize}
          nowMs={nowMs}
        />
      ) : null}
    </div>
  )
}

function parseState(raw: string | undefined): StageState {
  if (!raw) return DEFAULT_STATE

  try {
    const parsed = JSON.parse(raw) as StageState
    return {
      message: parsed.message ?? null,
      timers: Array.isArray(parsed.timers) ? parsed.timers.slice(0, MAX_STAGE_TIMERS) : [],
      timerVisualMode: parsed.timerVisualMode === 'compact' ? 'compact' : 'broadcast',
      clock: {
        hourFormat: parsed.clock?.hourFormat === '12' ? '12' : '24',
        showMeridiem: Boolean(parsed.clock?.showMeridiem)
      },
      focusMode: Boolean(parsed.focusMode)
    }
  } catch {
    return DEFAULT_STATE
  }
}
