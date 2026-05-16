import { PresentationView } from '@/ui/PresentationView'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { ContentScreen } from '@/contexts/ScheduleContext/types'
import { StageLayoutItem } from '../stage/shared/layout'
import { BASE_PRESENTATION_HEIGHT } from '@/lib/themeConstants'
import { StageTextWidget } from './StageTextWidget'
import { StageClockWidget } from './StageClockWidget'
import { StageMessageBlock } from './StageMessageBlock'
import { StageTimersList } from './StageTimersList'
import { ContainerSize, ResolvedTimer, StageState } from './types'
import { fitFontSizeToWidth, formatClock, parseAspectRatioToNumber } from './utils'

type Props = {
  sortedWidgets: StageLayoutItem[]
  stageState: StageState
  resolvedTimers: ResolvedTimer[]
  containerSize: ContainerSize
  nowMs: number
  isPreview: boolean
  content: ContentScreen | null
  stageTheme: ThemeWithMedia
  itemIndex: number
  themeTransitionKey: number
  presentationVerseBySlideKey: Record<string, number>
  displayId: number | undefined
  stageAspectRatio: string
  liveTitle: string
}

export function StageWidgets({
  sortedWidgets,
  stageState,
  resolvedTimers,
  containerSize,
  nowMs,
  isPreview,
  content,
  stageTheme,
  itemIndex,
  themeTransitionKey,
  presentationVerseBySlideKey,
  displayId,
  stageAspectRatio,
  liveTitle
}: Props) {
  const clockConfig = stageState.clock ?? { hourFormat: '24' as const, showMeridiem: false }

  return (
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
          const color = widget.config?.textColor ?? '#ffffff'
          const fontFamily = widget.config?.fontFamily ?? 'inherit'
          const fontSize = widget.config?.fontSize ?? 64
          const widgetHeightPx = (containerSize.height * widget.h) / 100
          const fontScale = isPreview ? widgetHeightPx / BASE_PRESENTATION_HEIGHT : 1
          const resolvedMessageFontSize = Math.max(12, fontSize * fontScale)
          const messagePaddingX = Math.max(4, Math.round(resolvedMessageFontSize * 0.22))
          const messagePaddingY = Math.max(2, Math.round(resolvedMessageFontSize * 0.12))

          return (
            <div
              key={widget.id}
              style={{
                ...style,
                paddingLeft: `${messagePaddingX}px`,
                paddingRight: `${messagePaddingX}px`,
                paddingTop: `${messagePaddingY}px`,
                paddingBottom: `${messagePaddingY}px`
              }}
              className="absolute wrap-break-word rounded-lg bg-black/55 font-semibold tracking-tight backdrop-blur-sm"
            >
              <StageMessageBlock
                message={stageState.message}
                color={color}
                fontFamily={fontFamily}
                fontSizePx={resolvedMessageFontSize}
                textAlign="left"
                className="h-full w-full "
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
          const fontFamily = widget.config?.fontFamily ?? 'monospace'
          const timerLabelFontSize = widget.config?.timerLabelFontSize ?? 36
          const timerValueFontSize = widget.config?.timerValueFontSize ?? 96
          const timerVisualMode = stageState.timerVisualMode ?? 'broadcast'

          const resolveColor = (remainingMs: number) => {
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
          const innerHorizontalPaddingPx = timerVisualMode === 'compact' ? 20 : 24
          const timerCardInnerWidthPx = Math.max(48, widgetWidthPx - innerHorizontalPaddingPx)
          const labelFontSizePx = Math.min(
            Math.max(10, timerLabelFontSize * timerScale),
            timerCardHeight * (timerVisualMode === 'compact' ? 0.2 : 0.24)
          )
          const valueFontSizeMaxPx = timerCardHeight * (timerVisualMode === 'compact' ? 0.52 : 0.62)
          const valueFontSizePx = Math.min(
            Math.max(
              14,
              timerValueFontSize * timerScale * (timerVisualMode === 'compact' ? 0.88 : 1)
            ),
            valueFontSizeMaxPx
          )

          return (
            <div
              key={widget.id}
              style={style}
              className="absolute grid content-start gap-2 overflow-hidden"
            >
              <StageTimersList
                resolvedTimers={resolvedTimers}
                fontFamily={fontFamily}
                resolveColor={resolveColor}
                labelFontSizePx={labelFontSizePx}
                valueFontSizePx={valueFontSizePx}
                valueFontSizeMaxPx={valueFontSizeMaxPx}
                valueContainerWidthPx={timerCardInnerWidthPx}
                listClassName={
                  timerVisualMode === 'compact'
                    ? 'grid content-start gap-1.5'
                    : 'grid content-start gap-2'
                }
                itemClassName={
                  timerVisualMode === 'compact'
                    ? 'rounded-lg border border-cyan-300/15 bg-cyan-500/8 px-2.5 py-1.5 backdrop-blur-sm'
                    : 'rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 backdrop-blur-sm'
                }
              />
            </div>
          )
        }

        if (widget.type === 'clock') {
          const clockText = formatClock(nowMs, clockConfig)
          const color = widget.config?.textColor ?? '#ffffff'
          const fontFamily = widget.config?.fontFamily ?? 'monospace'
          const fontSize = Math.min(96, Math.max(20, widget.config?.fontSize ?? 96))
          const widgetWidthPx = (containerSize.width * widget.w) / 100
          const fontScale = 1
          const scaledClockFontSize = Math.max(12, fontSize * fontScale)
          const widthFitFactor = 1
          const fittedClockFontSize = fitFontSizeToWidth(
            clockText,
            scaledClockFontSize,
            scaledClockFontSize,
            Math.max(32, (widgetWidthPx - 24) * widthFitFactor)
          )
          const clockPaddingX = Math.max(2, Math.round(fittedClockFontSize * 0.12))
          const clockPaddingY = Math.max(1, Math.round(fittedClockFontSize * 0.06))

          return (
            <div
              key={widget.id}
              style={{
                ...style,
                paddingLeft: `${clockPaddingX}px`,
                paddingRight: `${clockPaddingX}px`,
                paddingTop: `${clockPaddingY}px`,
                paddingBottom: `${clockPaddingY}px`
              }}
              className="absolute rounded-md bg-black/45 text-right font-mono tracking-wide text-white/90 backdrop-blur-sm"
            >
              <StageClockWidget
                text={clockText}
                color={color}
                fontFamily={fontFamily}
                fontSizePx={fittedClockFontSize}
                textAlign="right"
                className="h-full"
              />
            </div>
          )
        }

        if (widget.type === 'liveTitle') {
          if (!liveTitle) return null

          const color = widget.config?.textColor ?? '#ffffff'
          const fontFamily = widget.config?.fontFamily ?? 'inherit'
          const fontSize = widget.config?.fontSize ?? 56
          const widgetHeightPx = (containerSize.height * widget.h) / 100
          const fontScale = isPreview ? widgetHeightPx / BASE_PRESENTATION_HEIGHT : 1
          const resolvedTitleFontSize = Math.max(12, fontSize * fontScale)
          const titlePaddingX = Math.max(3, Math.round(resolvedTitleFontSize * 0.18))
          const titlePaddingY = Math.max(2, Math.round(resolvedTitleFontSize * 0.1))

          return (
            <div
              key={widget.id}
              style={{
                ...style,
                paddingLeft: `${titlePaddingX}px`,
                paddingRight: `${titlePaddingX}px`,
                paddingTop: `${titlePaddingY}px`,
                paddingBottom: `${titlePaddingY}px`
              }}
              className="absolute rounded-md bg-black/45 font-medium text-white/90 backdrop-blur-sm"
            >
              <StageTextWidget
                text={liveTitle}
                color={color}
                fontFamily={fontFamily}
                fontSize={fontSize}
                fontScale={fontScale}
                textAlign="left"
              />
            </div>
          )
        }

        if (widget.type === 'liveScreen') {
          const displayAspectRatio = parseAspectRatioToNumber(stageAspectRatio)
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
  )
}

// Re-export de fitFontSizeToWidth para compatibilidad interna
export { fitFontSizeToWidth }
