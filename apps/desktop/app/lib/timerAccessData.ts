export type TimerMode = 'duration' | 'clock'

export type TimerConfig = {
  v: 1
  mode: TimerMode
  durationSec: number
  startClock: string | null // 'HH:MM'
  title: string
  endMessage: string
  themeId: number | null
  // Colores opcionales; si son null se heredan del color de texto del tema.
  textColor: string | null
  ringColor: string | null
  autoHide: boolean
  endsAt: number | null
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  v: 1,
  mode: 'duration',
  durationSec: 900,
  startClock: null,
  title: 'El servicio comienza en',
  endMessage: 'El servicio va a comenzar',
  themeId: null,
  textColor: null,
  ringColor: null,
  autoHide: true,
  endsAt: null
}

export function encodeTimerAccessData(cfg: Partial<TimerConfig>): string {
  return JSON.stringify({ ...DEFAULT_TIMER_CONFIG, ...cfg, v: 1 })
}

export function parseTimerAccessData(accessData: string): TimerConfig {
  try {
    const parsed = JSON.parse(accessData) as Partial<TimerConfig>
    return { ...DEFAULT_TIMER_CONFIG, ...parsed, v: 1 }
  } catch {
    return { ...DEFAULT_TIMER_CONFIG }
  }
}

// Próxima ocurrencia de HH:MM a partir de `now` (si ya pasó hoy, salta al día siguiente).
export function computeClockEndsAt(startClock: string, now: number): number {
  const [hours, minutes] = startClock.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hours || 0, minutes || 0, 0, 0)
  let targetMs = target.getTime()
  if (targetMs <= now) {
    targetMs += 24 * 60 * 60 * 1000
  }
  return targetMs
}

export function computeTimerEndsAt(cfg: TimerConfig, now: number): number {
  if (cfg.mode === 'clock' && cfg.startClock) {
    return computeClockEndsAt(cfg.startClock, now)
  }
  return now + Math.max(0, cfg.durationSec) * 1000
}

// Arranca el reloj: fija `endsAt` y, en modo clock, deriva `durationSec` como total del anillo.
export function startTimer(cfg: TimerConfig, now: number): TimerConfig {
  const endsAt = computeTimerEndsAt(cfg, now)
  const durationSec =
    cfg.mode === 'clock' ? Math.max(1, Math.round((endsAt - now) / 1000)) : cfg.durationSec
  return { ...cfg, endsAt, durationSec }
}
