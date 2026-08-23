import { describe, expect, it } from 'vitest'
import {
  evaluateCycle,
  LIVE_RETRY_MS,
  MAX_LIVE_DEFER_MS,
  MIN_SYNC_INTERVAL_MS,
} from './oplog-schedule-policy'

const NOW = 1_000_000_000

const idle = { lastSyncAt: 0, deferredSince: 0, liveBusy: false }

describe('evaluateCycle', () => {
  it('corre el ciclo de arranque aunque haya vivo y sea inmediato', () => {
    const decision = evaluateCycle('startup', NOW, {
      lastSyncAt: NOW - 1_000,
      deferredSince: NOW - 1_000,
      liveBusy: true,
    })

    expect(decision).toEqual({ run: true })
  })

  it('corre un ciclo manual aunque haya vivo', () => {
    expect(evaluateCycle('manual', NOW, { ...idle, liveBusy: true })).toEqual({ run: true })
  })

  it('corre cuando no hay ciclo previo ni vivo', () => {
    expect(evaluateCycle('pending', NOW, idle)).toEqual({ run: true })
  })

  it('posterga si el ciclo anterior fue hace poco', () => {
    const decision = evaluateCycle('periodic', NOW, {
      ...idle,
      lastSyncAt: NOW - MIN_SYNC_INTERVAL_MS / 2,
    })

    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.deferred).toBe(false)
    expect(decision.retryIn).toBe(MIN_SYNC_INTERVAL_MS / 2)
  })

  it('corre cuando ya pasó el intervalo mínimo', () => {
    const decision = evaluateCycle('periodic', NOW, {
      ...idle,
      lastSyncAt: NOW - MIN_SYNC_INTERVAL_MS,
    })

    expect(decision).toEqual({ run: true })
  })

  it('posterga mientras se está proyectando', () => {
    const decision = evaluateCycle('pending', NOW, { ...idle, liveBusy: true })

    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.deferred).toBe(true)
    expect(decision.retryIn).toBe(LIVE_RETRY_MS)
    expect(decision.motive).toBe('en vivo')
  })

  it('sigue postergando mientras no se agote el tope de diferido', () => {
    const decision = evaluateCycle('pending', NOW, {
      ...idle,
      liveBusy: true,
      deferredSince: NOW - MAX_LIVE_DEFER_MS + 1_000,
    })

    expect(decision.run).toBe(false)
  })

  it('acaba corriendo aunque haya vivo si se agotó el tope de diferido', () => {
    const decision = evaluateCycle('pending', NOW, {
      ...idle,
      liveBusy: true,
      deferredSince: NOW - MAX_LIVE_DEFER_MS,
    })

    expect(decision).toEqual({ run: true })
  })

  it('el intervalo mínimo tiene prioridad sobre el diferido por vivo', () => {
    const decision = evaluateCycle('pending', NOW, {
      lastSyncAt: NOW - 1_000,
      deferredSince: NOW - MAX_LIVE_DEFER_MS * 2,
      liveBusy: true,
    })

    expect(decision.run).toBe(false)
    if (decision.run) return
    expect(decision.motive).toBe('intervalo mínimo')
  })
})
