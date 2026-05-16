import { describe, expect, it } from 'vitest'

import {
  buildRetryBackoffState,
  calculateRetryDelayMs
} from './googleDriveSyncManager'

describe('googleDriveSyncManager retry backoff', () => {
  it('calculateRetryDelayMs aplica crecimiento exponencial y tope máximo', () => {
    expect(calculateRetryDelayMs(1)).toBe(30_000)
    expect(calculateRetryDelayMs(2)).toBe(60_000)
    expect(calculateRetryDelayMs(3)).toBe(120_000)
    expect(calculateRetryDelayMs(6)).toBe(600_000)
    expect(calculateRetryDelayMs(7)).toBe(600_000)
    expect(calculateRetryDelayMs(20)).toBe(600_000)
  })

  it('buildRetryBackoffState incrementa retryCount y calcula nextRetryAt/nextRunAt', () => {
    const baseMs = Date.parse('2026-03-09T18:00:00.000Z')

    const first = buildRetryBackoffState(0, baseMs)
    expect(first.retryCount).toBe(1)
    expect(first.delayMs).toBe(30_000)
    expect(first.nextRetryAt).toBe('2026-03-09T18:00:30.000Z')
    expect(first.nextRunAt).toBe('2026-03-09T18:00:30.000Z')

    const second = buildRetryBackoffState(1, baseMs)
    expect(second.retryCount).toBe(2)
    expect(second.delayMs).toBe(60_000)
    expect(second.nextRetryAt).toBe('2026-03-09T18:01:00.000Z')
    expect(second.nextRunAt).toBe('2026-03-09T18:01:00.000Z')
  })
})
