export type TimerThresholdUnit = 'seconds' | 'minutes'

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const clampTimerThresholdSeconds = (value: number): number => {
  return Math.min(3600, Math.max(0, Math.round(value)))
}

export const resolveTimerThresholdUnit = (seconds: number): TimerThresholdUnit => {
  const safeSeconds = clampTimerThresholdSeconds(toFiniteNumber(seconds))
  if (safeSeconds >= 60 && safeSeconds % 60 === 0) return 'minutes'
  return 'seconds'
}

export const toTimerThresholdDisplayValue = (
  seconds: number,
  unit: TimerThresholdUnit
): number => {
  const safeSeconds = clampTimerThresholdSeconds(toFiniteNumber(seconds))

  if (unit === 'minutes') {
    return Math.max(0, Math.round(safeSeconds / 60))
  }

  return safeSeconds
}

export const toTimerThresholdSeconds = (value: number, unit: TimerThresholdUnit): number => {
  const safeValue = Math.max(0, Math.round(toFiniteNumber(value)))
  const rawSeconds = unit === 'minutes' ? safeValue * 60 : safeValue

  return clampTimerThresholdSeconds(rawSeconds)
}
