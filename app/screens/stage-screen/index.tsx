import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Variants } from 'framer-motion'
import { BlankTheme } from '@/hooks/useThemes'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { PresentationView } from '@/ui/PresentationView'
import { AnimatedText } from '@/ui/PresentationView/components/AnimatedText'
import { ScreenContentUpdate } from 'electron/main/displayManager/displayType'
import { DEFAULT_STAGE_LAYOUT, StageLayout, parseStageLayout } from '../stage/shared/layout'
import { useScreenSize } from '@/contexts/ScreenSizeContext'
import { BASE_PRESENTATION_HEIGHT } from '@/lib/themeConstants'

type StageScreenProps = {
  isPreview?: boolean
  previewDisplayId?: number
}

type StageTimer = {
  id?: string | number
  label?: string
  endsAt?: string | number
  endAt?: string | number
  remainingMs?: number
}

type StageState = {
  message?: string | null
  timers?: StageTimer[]
  clock?: {
    hourFormat?: '12' | '24'
    showMeridiem?: boolean
  }
}

const DEFAULT_STATE: StageState = {
  message: null,
  timers: [],
  clock: {
    hourFormat: '24',
    showMeridiem: false
  }
}

const MAX_STAGE_TIMERS = 5

type StageScreenConfigUpdate = {
  selectedScreenId: number
}

type StageTextWidgetProps = {
  text: string
  color: string
  fontFamily: string
  fontSize: number
  fontScale?: number
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'center' | 'bottom'
  paddingInline?: number
  paddingBlock?: number
}

type StageTimerTextLineProps = {
  color: string
  fontFamily: string
  label: string
  value: string
  labelFontSizePx: number
  valueFontSizePx: number
  valueFontSizeMaxPx: number
  valueContainerWidthPx: number
}

const EMPTY_ANIMATION_VARIANTS: Variants = {
  initial: {},
  animate: {},
  exit: {}
}

function resolveRemainingMs(timer: StageTimer, now: number): number {
  if (typeof timer.remainingMs === 'number') {
    return timer.remainingMs
  }

  const endAtCandidate = timer.endsAt ?? timer.endAt
  if (endAtCandidate == null) {
    return 0
  }

  const endsAtMs =
    typeof endAtCandidate === 'number' ? endAtCandidate : Date.parse(String(endAtCandidate))

  if (Number.isNaN(endsAtMs)) {
    return 0
  }

  return endsAtMs - now
}

function formatRemaining(remainingMs: number): string {
  const isNegative = remainingMs < 0
  const absRemainingMs = Math.abs(remainingMs)
  const totalSeconds = Math.floor(absRemainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const sign = isNegative ? '-' : ''

  if (hours > 0) {
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${sign}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function fitTimerValueFontSize(
  value: string,
  preferredFontSizePx: number,
  maxFontSizePx: number,
  containerWidthPx: number
): number {
  const safeWidth = Math.max(48, containerWidthPx)
  const glyphFactor = 0.58
  const textLength = Math.max(4, value.length)
  const widthFitFontSize = safeWidth / (textLength * glyphFactor)

  return Math.max(14, Math.min(preferredFontSizePx, maxFontSizePx, widthFitFontSize))
}

function formatClock(
  now: number,
  clockConfig: {
    hourFormat?: '12' | '24'
    showMeridiem?: boolean
  }
): string {
  const hourFormat = clockConfig.hourFormat === '12' ? '12' : '24'
  const showMeridiem = Boolean(clockConfig.showMeridiem)
  const date = new Date(now)
  const minutes = date.getMinutes().toString().padStart(2, '0')

  if (hourFormat === '24') {
    const hours24 = date.getHours().toString().padStart(2, '0')
    return `${hours24}:${minutes}`
  }

  const rawHours = date.getHours()
  const hours12 = rawHours % 12 || 12
  const hourText = hours12.toString().padStart(2, '0')

  if (!showMeridiem) {
    return `${hourText}:${minutes}`
  }

  const suffix = rawHours >= 12 ? 'PM' : 'AM'
  return `${hourText}:${minutes} ${suffix}`
}

function parseAspectRatioToNumber(aspectRatio: string): number {
  const [rawWidth, rawHeight] = aspectRatio.split('/').map((value) => Number(value.trim()))
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawHeight <= 0) {
    return 16 / 9
  }

  return rawWidth / rawHeight
}

function StageTextWidget({
  text,
  color,
  fontFamily,
  fontSize,
  fontScale = 1,
  fontWeight = 700,
  textAlign = 'center',
  verticalAlign = 'center',
  paddingInline = 16,
  paddingBlock = 8
}: StageTextWidgetProps) {
  const resolvedFontSize = Math.max(10, fontSize * fontScale)
  const resolvedPaddingInline = Math.max(2, paddingInline * fontScale)
  const resolvedPaddingBlock = Math.max(1, paddingBlock * fontScale)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatedText
        item={{
          text,
          resourceType: 'TEXT'
        }}
        animationType="none"
        variants={EMPTY_ANIMATION_VARIANTS}
        textStyle={{
          color,
          fontFamily,
          fontWeight,
          fontSize: `${resolvedFontSize}px`,
          lineHeight: 1.05,
          textAlign,
          whiteSpace: 'pre-wrap'
        }}
        isPreview={false}
        textContainerPadding={{
          horizontal: resolvedPaddingInline,
          vertical: resolvedPaddingBlock
        }}
        textContainerOffset={{ x: 0, y: 0 }}
        verticalAlign={verticalAlign}
        showTextBounds={false}
      />
    </div>
  )
}

function StageTimerTextLine({
  color,
  fontFamily,
  label,
  value,
  labelFontSizePx,
  valueFontSizePx,
  valueFontSizeMaxPx,
  valueContainerWidthPx
}: StageTimerTextLineProps) {
  const fittedValueFontSize = fitTimerValueFontSize(
    value,
    valueFontSizePx,
    valueFontSizeMaxPx,
    valueContainerWidthPx
  )
  const valueContainerHeightPx = Math.max(20, fittedValueFontSize * 1.14)

  return (
    <div className="flex w-full flex-col justify-start overflow-hidden">
      <div
        className="w-full truncate text-left leading-none"
        style={{
          color,
          fontFamily,
          fontWeight: 600,
          fontSize: `${labelFontSizePx}px`
        }}
      >
        {label}
      </div>
      <div
        className="relative mt-[0.06em] w-full overflow-hidden"
        style={{ height: `${valueContainerHeightPx}px` }}
      >
        <AnimatedText
          item={{
            text: value,
            resourceType: 'TEXT'
          }}
          animationType="none"
          variants={EMPTY_ANIMATION_VARIANTS}
          textStyle={{
            color,
            fontFamily,
            fontWeight: 700,
            fontSize: `${fittedValueFontSize}px`,
            lineHeight: 0.95,
            textAlign: 'center',
            whiteSpace: 'nowrap'
          }}
          isPreview={false}
          textContainerPadding={{ horizontal: 0, vertical: 0 }}
          textContainerOffset={{ x: 0, y: 0 }}
          verticalAlign="center"
          showTextBounds={false}
        />
      </div>
    </div>
  )
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
  const stageScreenSize = useScreenSize(100, displayId)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState(() => ({
    width: 1280,
    height: 720
  }))

  const hasConfiguredThemeRef = useRef(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const applyTheme = useCallback((theme: ThemeWithMedia, marker: string) => {
    setStageTheme(theme)

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
        hasConfiguredThemeRef.current = false
        setLayout(DEFAULT_STAGE_LAYOUT)
        setStageState(DEFAULT_STATE)
        applyTheme(liveTheme, `live:${liveTheme.id}`)
        return
      }

      setLayout(parseStageLayout(config.layout))
      setStageState(
        (() => {
          try {
            return JSON.parse(config.state ?? '{}') as StageState
          } catch {
            return DEFAULT_STATE
          }
        })()
      )

      if (config.themeId) {
        const configuredTheme = await window.api.themes.getThemeById(config.themeId)
        hasConfiguredThemeRef.current = true
        applyTheme(configuredTheme, `configured:${configuredTheme.id}`)
      } else {
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
        setItemIndex(data.itemIndex)
        setContent(data.contentScreen)
        setPresentationVerseBySlideKey(data.presentationVerseBySlideKey || {})
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
          hasConfiguredThemeRef.current = false
          applyTheme(liveTheme, `live:${liveTheme.id}`)
          return
        }

        setLayout(parseStageLayout(config.layout))
        setStageState(
          (() => {
            try {
              return JSON.parse(config.state ?? '{}') as StageState
            } catch {
              return DEFAULT_STATE
            }
          })()
        )

        if (config.themeId) {
          const configuredTheme = await window.api.themes.getThemeById(config.themeId)
          hasConfiguredThemeRef.current = true
          applyTheme(configuredTheme, `configured:${configuredTheme.id}`)
        } else {
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
  const clockConfig = stageState.clock ?? DEFAULT_STATE.clock!

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

      <div className="pointer-events-none absolute inset-0 z-20">
        {sortedWidgets.map((widget) => {
          const style: React.CSSProperties = {
            left: `${widget.x}%`,
            top: `${widget.y}%`,
            width: `${widget.w}%`,
            height: `${widget.h}%`,
            zIndex: widget.z
          }

          if (widget.type === 'message') {
            if (!stageState.message) return null

            const textColor = widget.config?.textColor ?? '#ffffff'
            const fontFamily = widget.config?.fontFamily ?? 'inherit'
            const fontSize = widget.config?.fontSize ?? 64
            const widgetHeightPx = (containerSize.height * widget.h) / 100
            const textScale = isPreview ? widgetHeightPx / BASE_PRESENTATION_HEIGHT : 1

            return (
              <div
                key={widget.id}
                style={style}
                className="absolute rounded-lg bg-black/55 px-4 py-3 font-semibold tracking-tight backdrop-blur-sm"
              >
                <StageTextWidget
                  text={stageState.message}
                  color={textColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  fontScale={textScale}
                  textAlign="left"
                />
              </div>
            )
          }

          if (widget.type === 'timers') {
            if (resolvedTimers.length === 0) return null

            const onTimeColor = widget.config?.timerOnTimeColor ?? '#22d3ee'
            const warningColor = widget.config?.timerWarningColor ?? '#f59e0b'
            const overdueColor = widget.config?.timerOverdueColor ?? '#ef4444'
            const warningThresholdMs = (widget.config?.timerWarningThresholdSeconds ?? 30) * 1000
            const timerFontFamily = widget.config?.fontFamily ?? 'monospace'
            const timerLabelFontSize = widget.config?.timerLabelFontSize ?? 36
            const timerValueFontSize = widget.config?.timerValueFontSize ?? 96

            const resolveTimerColor = (remainingMs: number) => {
              if (remainingMs < 0) return overdueColor
              if (remainingMs <= warningThresholdMs) return warningColor
              return onTimeColor
            }

            const widgetHeightPx = (containerSize.height * widget.h) / 100
            const widgetWidthPx = (containerSize.width * widget.w) / 100
            const timerGapPx = 8
            const totalGaps = Math.max(0, resolvedTimers.length - 1) * timerGapPx
            const timerCardHeight = (widgetHeightPx - totalGaps) / resolvedTimers.length
            const timerScale = timerCardHeight / BASE_PRESENTATION_HEIGHT
            const timerCardInnerWidthPx = Math.max(48, widgetWidthPx - 24)
            const labelFontSizePx = Math.min(
              Math.max(10, timerLabelFontSize * timerScale),
              timerCardHeight * 0.24
            )
            const valueFontSizeMaxPx = timerCardHeight * 0.62
            const valueFontSizePx = Math.min(
              Math.max(14, timerValueFontSize * timerScale),
              valueFontSizeMaxPx
            )

            return (
              <div
                key={widget.id}
                style={style}
                className="absolute grid gap-2 overflow-hidden content-start"
              >
                {resolvedTimers.map((timer) => (
                  <div
                    key={timer.key}
                    className="rounded-lg bg-cyan-500/12 px-3 py-2 backdrop-blur-sm"
                  >
                    <StageTimerTextLine
                      color={resolveTimerColor(timer.remainingMs)}
                      fontFamily={timerFontFamily}
                      label={timer.label}
                      value={timer.value}
                      labelFontSizePx={labelFontSizePx}
                      valueFontSizePx={valueFontSizePx}
                      valueFontSizeMaxPx={valueFontSizeMaxPx}
                      valueContainerWidthPx={timerCardInnerWidthPx}
                    />
                  </div>
                ))}
              </div>
            )
          }

          if (widget.type === 'clock') {
            const clockText = formatClock(nowMs, clockConfig)
            const clockTextColor = widget.config?.textColor ?? '#ffffff'
            const clockFontFamily = widget.config?.fontFamily ?? 'monospace'
            const clockFontSize = Math.min(96, Math.max(20, widget.config?.fontSize ?? 96))
            const widgetHeightPx = (containerSize.height * widget.h) / 100
            const textScale = isPreview ? widgetHeightPx / BASE_PRESENTATION_HEIGHT : 1

            return (
              <div
                key={widget.id}
                style={style}
                className="absolute rounded-md bg-black/45 px-3 py-1.5 text-right font-mono tracking-wide text-white/90 backdrop-blur-sm"
              >
                <StageTextWidget
                  text={clockText}
                  color={clockTextColor}
                  fontFamily={clockFontFamily}
                  fontSize={clockFontSize}
                  fontScale={textScale}
                  textAlign="right"
                  paddingInline={10}
                  paddingBlock={2}
                />
              </div>
            )
          }

          if (widget.type === 'liveTitle') {
            if (!liveTitle) return null

            const titleColor = widget.config?.textColor ?? '#ffffff'
            const titleFontFamily = widget.config?.fontFamily ?? 'inherit'
            const titleFontSize = widget.config?.fontSize ?? 56
            const widgetHeightPx = (containerSize.height * widget.h) / 100
            const textScale = isPreview ? widgetHeightPx / BASE_PRESENTATION_HEIGHT : 1

            return (
              <div
                key={widget.id}
                style={style}
                className="absolute rounded-md bg-black/45 px-3 py-1.5 font-medium text-white/90 backdrop-blur-sm"
              >
                <StageTextWidget
                  text={liveTitle}
                  color={titleColor}
                  fontFamily={titleFontFamily}
                  fontSize={titleFontSize}
                  fontScale={textScale}
                  textAlign="left"
                />
              </div>
            )
          }

          if (widget.type === 'liveScreen') {
            const displayAspectRatio = parseAspectRatioToNumber(stageScreenSize.aspectRatio)
            const widgetAspectRatio =
              (displayAspectRatio * Math.max(widget.w, 1)) / Math.max(widget.h, 1)

            return (
              <div key={widget.id} style={style} className="absolute overflow-hidden rounded-md">
                <PresentationView
                  items={content?.content || []}
                  theme={stageTheme}
                  currentIndex={itemIndex}
                  themeTransitionKey={themeTransitionKey}
                  presentationVerseBySlideKey={presentationVerseBySlideKey}
                  live
                  displayId={displayId}
                  customAspectRatio={`${widgetAspectRatio} / 1`}
                  key={0}
                />
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
