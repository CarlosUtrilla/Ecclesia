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

export function resolveRemainingMs(
  timer: { remainingMs?: number; endsAt?: string | number; endAt?: string | number },
  now: number
): number {
  if (typeof timer.remainingMs === 'number') return timer.remainingMs

  const endAtCandidate = timer.endsAt ?? timer.endAt
  if (endAtCandidate == null) return 0

  const endsAtMs =
    typeof endAtCandidate === 'number' ? endAtCandidate : Date.parse(String(endAtCandidate))

  if (Number.isNaN(endsAtMs)) return 0

  return endsAtMs - now
}
