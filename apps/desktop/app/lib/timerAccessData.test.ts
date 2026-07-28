import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TIMER_CONFIG,
  encodeTimerAccessData,
  parseTimerAccessData,
  computeClockEndsAt,
  computeTimerEndsAt,
  startTimer
} from './timerAccessData'

describe('timerAccessData', () => {
  describe('encode/parse', () => {
    it('debería aplicar defaults al encodear parcial', () => {
      const encoded = encodeTimerAccessData({ durationSec: 60 })
      const parsed = JSON.parse(encoded)
      expect(parsed.durationSec).toBe(60)
      expect(parsed.title).toBe(DEFAULT_TIMER_CONFIG.title)
      expect(parsed.v).toBe(1)
    })

    it('debería round-trip encode → parse', () => {
      const cfg = { mode: 'clock' as const, startClock: '10:30', durationSec: 300, endsAt: 12345 }
      const parsed = parseTimerAccessData(encodeTimerAccessData(cfg))
      expect(parsed.mode).toBe('clock')
      expect(parsed.startClock).toBe('10:30')
      expect(parsed.endsAt).toBe(12345)
    })

    it('debería devolver defaults ante JSON inválido', () => {
      const parsed = parseTimerAccessData('no-es-json')
      expect(parsed).toEqual(DEFAULT_TIMER_CONFIG)
    })
  })

  describe('computeClockEndsAt', () => {
    it('debería devolver la hora de hoy si aún no ha pasado', () => {
      const now = new Date('2026-07-26T09:00:00').getTime()
      const endsAt = computeClockEndsAt('11:00', now)
      expect(new Date(endsAt).getHours()).toBe(11)
      expect(endsAt).toBeGreaterThan(now)
      expect(endsAt - now).toBe(2 * 60 * 60 * 1000)
    })

    it('debería saltar al día siguiente si la hora ya pasó', () => {
      const now = new Date('2026-07-26T12:00:00').getTime()
      const endsAt = computeClockEndsAt('11:00', now)
      expect(endsAt - now).toBe(23 * 60 * 60 * 1000)
    })
  })

  describe('computeTimerEndsAt', () => {
    it('modo duración: now + durationSec', () => {
      const cfg = { ...DEFAULT_TIMER_CONFIG, mode: 'duration' as const, durationSec: 120 }
      expect(computeTimerEndsAt(cfg, 1000)).toBe(1000 + 120 * 1000)
    })

    it('modo clock: usa la próxima ocurrencia', () => {
      const now = new Date('2026-07-26T09:00:00').getTime()
      const cfg = { ...DEFAULT_TIMER_CONFIG, mode: 'clock' as const, startClock: '11:00' }
      expect(computeTimerEndsAt(cfg, now)).toBe(computeClockEndsAt('11:00', now))
    })
  })

  describe('startTimer', () => {
    it('modo clock: deriva durationSec como total del anillo', () => {
      const now = new Date('2026-07-26T09:00:00').getTime()
      const cfg = { ...DEFAULT_TIMER_CONFIG, mode: 'clock' as const, startClock: '10:00', durationSec: 0 }
      const started = startTimer(cfg, now)
      expect(started.endsAt).toBe(computeClockEndsAt('10:00', now))
      expect(started.durationSec).toBe(3600)
    })

    it('modo duración: mantiene durationSec y fija endsAt', () => {
      const cfg = { ...DEFAULT_TIMER_CONFIG, mode: 'duration' as const, durationSec: 90 }
      const started = startTimer(cfg, 5000)
      expect(started.durationSec).toBe(90)
      expect(started.endsAt).toBe(5000 + 90 * 1000)
    })
  })
})
