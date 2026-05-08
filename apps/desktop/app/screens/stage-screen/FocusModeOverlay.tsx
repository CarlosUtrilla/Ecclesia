import { StageLayoutItem } from '../stage/shared/layout'
import { ContainerSize, ResolvedTimer, StageState } from './types'
import { fitFontSizeToWidth, formatClock } from './utils'
import { StageClockWidget } from './StageClockWidget'
import { StageMessageBlock } from './StageMessageBlock'
import { StageTimersList } from './StageTimersList'

type Props = {
  stageState: StageState
  sortedWidgets: StageLayoutItem[]
  resolvedTimers: ResolvedTimer[]
  containerSize: ContainerSize
  nowMs: number
}

export function FocusModeOverlay({
  stageState,
  sortedWidgets,
  resolvedTimers,
  containerSize,
  nowMs
}: Props) {
  const clockConfig = stageState.clock ?? { hourFormat: '24', showMeridiem: false }
  const clockWidget = sortedWidgets.find((w) => w.type === 'clock')
  const timerWidget = sortedWidgets.find((w) => w.type === 'timers')
  const messageWidget = sortedWidgets.find((w) => w.type === 'message')

  const hasClock = Boolean(clockWidget)
  const hasTimers = Boolean(timerWidget) && resolvedTimers.length > 0
  const hasMessage = Boolean(messageWidget) && Boolean(stageState.message)

  if (!hasClock && !hasTimers && !hasMessage) return null

  const availableWidth = containerSize.width * 0.88

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-[4%] bg-black/85 px-[6%]">
      {hasClock && clockWidget ? (
        <ClockBlock
          nowMs={nowMs}
          clockConfig={clockConfig}
          widget={clockWidget}
          availableWidth={availableWidth}
          containerWidth={containerSize.width}
        />
      ) : null}

      {hasTimers && timerWidget ? (
        <TimersBlock
          resolvedTimers={resolvedTimers}
          widget={timerWidget}
          containerSize={containerSize}
          timerVisualMode={stageState.timerVisualMode ?? 'broadcast'}
        />
      ) : null}

      {hasMessage && messageWidget ? (
        <MessageBlock
          message={stageState.message!}
          widget={messageWidget}
          containerHeight={containerSize.height}
          containerWidth={containerSize.width}
        />
      ) : null}
    </div>
  )
}

// ── Sub-bloques ──────────────────────────────────────────────────────────────

type ClockBlockProps = {
  nowMs: number
  clockConfig: { hourFormat?: '12' | '24'; showMeridiem?: boolean }
  widget: StageLayoutItem
  availableWidth: number
  containerWidth: number
}

function ClockBlock({
  nowMs,
  clockConfig,
  widget,
  availableWidth,
  containerWidth
}: ClockBlockProps) {
  const clockText = formatClock(nowMs, clockConfig)
  const color = widget.config?.textColor ?? '#ffffff'
  const fontFamily = widget.config?.fontFamily ?? 'monospace'
  // La hora cede espacio: preferido 11% del ancho para priorizar mensaje y timers
  const fontSize = fitFontSizeToWidth(
    clockText,
    containerWidth * 0.11,
    containerWidth * 0.11,
    availableWidth
  )

  return (
    <StageClockWidget
      text={clockText}
      color={color}
      fontFamily={fontFamily}
      fontSizePx={fontSize}
      textAlign="center"
      className="w-full shrink-0"
    />
  )
}

type TimersBlockProps = {
  resolvedTimers: ResolvedTimer[]
  widget: StageLayoutItem
  containerSize: ContainerSize
  timerVisualMode: 'compact' | 'broadcast'
}

function TimersBlock({ resolvedTimers, widget, containerSize, timerVisualMode }: TimersBlockProps) {
  const onTimeColor = widget.config?.timerOnTimeColor ?? '#22d3ee'
  const warningColor = widget.config?.timerWarningColor ?? '#f59e0b'
  const overdueColor = widget.config?.timerOverdueColor ?? '#ef4444'
  const warningThresholdMs = (widget.config?.timerWarningThresholdSeconds ?? 30) * 1000
  const fontFamily = widget.config?.fontFamily ?? 'monospace'

  const resolveColor = (remainingMs: number) => {
    if (remainingMs < 0) return overdueColor
    if (remainingMs <= warningThresholdMs) return warningColor
    return onTimeColor
  }

  const slotsCount = resolvedTimers.length
  const slotHeightPx = Math.min(
    (containerSize.height * (timerVisualMode === 'compact' ? 0.42 : 0.52)) / slotsCount,
    containerSize.height * (timerVisualMode === 'compact' ? 0.26 : 0.33)
  )
  const labelFontPx = Math.max(12, slotHeightPx * (timerVisualMode === 'compact' ? 0.15 : 0.2))
  const valueFontPx = Math.max(20, slotHeightPx * (timerVisualMode === 'compact' ? 0.46 : 0.62))
  const valueWidthPx = containerSize.width * (timerVisualMode === 'compact' ? 0.76 : 0.88)

  return (
    <StageTimersList
      resolvedTimers={resolvedTimers}
      fontFamily={fontFamily}
      resolveColor={resolveColor}
      labelFontSizePx={labelFontPx}
      valueFontSizePx={valueFontPx}
      valueFontSizeMaxPx={valueFontPx * 1.2}
      valueContainerWidthPx={valueWidthPx}
      listClassName={
        timerVisualMode === 'compact'
          ? 'flex w-full flex-col items-center gap-[0.7%]'
          : 'flex w-full flex-col items-center gap-[1%]'
      }
      itemClassName={
        timerVisualMode === 'compact'
          ? 'w-full rounded-lg border border-cyan-300/18 bg-cyan-500/8 px-[2.3%] py-[0.7%]'
          : 'w-full rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-[2.8%] py-[0.9%] shadow-[0_8px_24px_rgba(6,182,212,0.08)]'
      }
    />
  )
}

type MessageBlockProps = {
  message: string
  widget: StageLayoutItem
  containerHeight: number
  containerWidth: number
}

function MessageBlock({ message, widget, containerHeight, containerWidth }: MessageBlockProps) {
  const color = widget.config?.textColor ?? '#ffffff'
  const fontFamily = widget.config?.fontFamily ?? 'inherit'
  const configuredFontSize = widget.config?.fontSize ?? 64
  const screenScale = Math.max(0.32, Math.min(1, containerHeight / 1080))
  const preferredFontSize = Math.max(20, configuredFontSize * screenScale, containerHeight * 0.06)
  // Usar la palabra más larga para fitFontSizeToWidth: el texto hace wrap libremente,
  // solo se limita para evitar que una sola palabra irrompible desborde.
  const longestWord = message.split(/\s+/).reduce((a, b) => (a.length > b.length ? a : b), '')
  const fontSize = fitFontSizeToWidth(
    longestWord,
    preferredFontSize,
    preferredFontSize,
    containerWidth * 0.88
  )

  return (
    <StageMessageBlock
      message={message}
      color={color}
      fontFamily={fontFamily}
      fontSizePx={fontSize}
      textAlign="center"
      fontWeight={600}
      className="w-full wrap-break-word shrink-0 rounded-xl bg-black/55 px-[4%] py-[1.5%] text-center tracking-tight backdrop-blur-sm"
    />
  )
}
