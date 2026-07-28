import { useEffect, useMemo, useState } from 'react'
import { formatRemaining, resolveRemainingMs } from '@/lib/time'
import type { PresentationViewProps } from '../types'

type Props = {
  item: PresentationViewProps['items'][number]
  theme: PresentationViewProps['theme']
  isPreview: boolean
  // Altura real del contenedor renderizado (px). Igual que AnimatedText/BibleTextRender,
  // el tamaño de fuente se escala proporcional a esta altura para auto-ajustarse a
  // preview (pequeño) y live (pantalla completa) sin usar unidades de viewport.
  presentationHeight: number
}

function resolveThemeTextColor(theme: Props['theme']): string {
  const textStyle = theme.textStyle
  if (!textStyle) return '#ffffff'

  if (typeof textStyle === 'string') {
    try {
      return (JSON.parse(textStyle) as { color?: string }).color || '#ffffff'
    } catch {
      return '#ffffff'
    }
  }

  return (textStyle as { color?: string }).color || '#ffffff'
}

// Anillo radial cuyo arco se vacía conforme se acaba el tiempo.
function CountdownRing({
  fraction,
  color,
  children
}: {
  fraction: number
  color: string
  children: React.ReactNode
}) {
  const radius = 46
  const strokeWidth = 3
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, fraction))
  const dashOffset = circumference * (1 - clamped)

  return (
    <div className="relative flex items-center justify-center" style={{ width: '55%', aspectRatio: '1 / 1' }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={strokeWidth} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.95s linear' }}
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function TimerRender({ item, theme, isPreview, presentationHeight }: Props) {
  const timer = item.timer
  const themeColor = useMemo(() => resolveThemeTextColor(theme), [theme])
  const textColor = timer?.textColor || themeColor
  const ringColor = timer?.ringColor || themeColor

  const [now, setNow] = useState(() => Date.now())

  const hasStarted = !!timer && timer.endsAt != null

  useEffect(() => {
    if (!hasStarted) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [hasStarted, timer?.endsAt])

  if (!timer) return null

  // Escala proporcional a la altura real renderizada (fallback a un valor pequeño
  // hasta que el ResizeObserver mide el contenedor).
  const base = presentationHeight > 0 ? presentationHeight : 200
  const titleFontSize = base * 0.05
  const numberFontSize = base * 0.16
  const endMessageFontSize = base * 0.1
  const hintFontSize = base * 0.03

  const totalMs = Math.max(1, timer.durationSec * 1000)
  const remainingMs = hasStarted ? resolveRemainingMs({ endsAt: timer.endsAt! }, now) : totalMs
  const isFinished = hasStarted && remainingMs <= 0
  const fraction = hasStarted ? remainingMs / totalMs : 1

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-[3%]"
      style={{ color: textColor }}
    >
      {isFinished ? (
        <div
          className="px-8 text-center font-semibold"
          style={{ fontSize: endMessageFontSize, lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
        >
          {timer.endMessage}
        </div>
      ) : (
        <CountdownRing fraction={fraction} color={ringColor}>
          {timer.title ? (
            <div style={{ fontSize: titleFontSize, opacity: 0.85, marginBottom: '0.4em' }}>
              {timer.title}
            </div>
          ) : null}
          <div
            style={{
              fontSize: numberFontSize,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              lineHeight: 1
            }}
          >
            {formatRemaining(Math.max(0, remainingMs))}
          </div>
          {!hasStarted && isPreview ? (
            <div style={{ fontSize: hintFontSize, opacity: 0.6, marginTop: '0.6em' }}>Sin iniciar</div>
          ) : null}
        </CountdownRing>
      )}
    </div>
  )
}
