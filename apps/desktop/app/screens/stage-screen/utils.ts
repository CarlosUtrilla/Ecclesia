import { StageTimer } from './types'

export const MAX_STAGE_TIMERS = 5

export function resolveRemainingMs(timer: StageTimer, now: number): number {
  if (typeof timer.remainingMs === 'number') {
    return timer.remainingMs
  }

  const endAtCandidate = timer.endsAt ?? timer.endAt
  if (endAtCandidate == null) return 0

  const endsAtMs =
    typeof endAtCandidate === 'number' ? endAtCandidate : Date.parse(String(endAtCandidate))

  if (Number.isNaN(endsAtMs)) return 0

  return endsAtMs - now
}

export function formatRemaining(remainingMs: number): string {
  const isNegative = remainingMs < 0
  const abs = Math.abs(remainingMs)
  const totalSeconds = Math.floor(abs / 1000)
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

/**
 * Calcula un font size que garantiza que el texto cabe en el ancho del contenedor.
 * Respeta el tamaño preferido y máximo, pero nunca desborda el contenedor.
 */
export function fitFontSizeToWidth(
  text: string,
  preferredPx: number,
  maxPx: number,
  containerWidthPx: number
): number {
  const safeWidth = Math.max(48, containerWidthPx)
  const glyphFactor = 0.6
  const textLength = Math.max(1, text.length)
  const widthFitPx = safeWidth / (textLength * glyphFactor)

  return Math.max(14, Math.min(preferredPx, maxPx, widthFitPx))
}

export function formatClock(
  now: number,
  clockConfig: { hourFormat?: '12' | '24'; showMeridiem?: boolean }
): string {
  const hourFormat = clockConfig.hourFormat === '12' ? '12' : '24'
  const showMeridiem = Boolean(clockConfig.showMeridiem)
  const date = new Date(now)
  const minutes = date.getMinutes().toString().padStart(2, '0')

  if (hourFormat === '24') {
    return `${date.getHours().toString().padStart(2, '0')}:${minutes}`
  }

  const rawHours = date.getHours()
  const hours12 = rawHours % 12 || 12
  const hourText = hours12.toString().padStart(2, '0')

  if (!showMeridiem) return `${hourText}:${minutes}`

  return `${hourText}:${minutes} ${rawHours >= 12 ? 'PM' : 'AM'}`
}

export function parseAspectRatioToNumber(aspectRatio: string): number {
  const [rawWidth, rawHeight] = aspectRatio.split('/').map((v) => Number(v.trim()))
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawHeight <= 0) return 16 / 9
  return rawWidth / rawHeight
}
