import { beforeEach, describe, expect, it } from 'vitest'
import {
  isLiveEvent,
  isLiveBusy,
  LIVE_GRACE_MS,
  markLiveActivity,
  resetLiveActivity,
} from './live-activity.service'

describe('live-activity', () => {
  beforeEach(() => resetLiveActivity())

  it('arranca sin actividad de vivo', () => {
    expect(isLiveBusy()).toBe(false)
  })

  it('reconoce qué eventos son de vivo', () => {
    expect(isLiveEvent('liveNextSlide')).toBe(true)
    expect(isLiveEvent('obsTextUpdate')).toBe(true)
    expect(isLiveEvent('scheduleStateUpdate')).toBe(false)
    expect(isLiveEvent('requestScheduleState')).toBe(false)
  })

  it('ignora los eventos que no son de vivo', () => {
    markLiveActivity('scheduleStateUpdate', { items: [] })

    expect(isLiveBusy()).toBe(false)
  })

  it('marca ocupado con un comando de vivo', () => {
    markLiveActivity('liveNextSlide')

    expect(isLiveBusy()).toBe(true)
  })

  it('queda ocupado mientras haya un item en vivo', () => {
    markLiveActivity('liveStateUpdate', { itemOnLive: { id: '1' }, showLiveScreen: false })

    // Sigue ocupado aunque pase la ventana de gracia: se está proyectando
    expect(isLiveBusy(Date.now() + LIVE_GRACE_MS * 10)).toBe(true)
  })

  it('queda ocupado si la pantalla en vivo está encendida sin item', () => {
    markLiveActivity('liveStateUpdate', { itemOnLive: null, showLiveScreen: true })

    expect(isLiveBusy()).toBe(true)
  })

  it('deja de estar ocupado tras la ventana de gracia si no hay nada en vivo', () => {
    markLiveActivity('liveStateUpdate', { itemOnLive: null, showLiveScreen: false })

    expect(isLiveBusy()).toBe(true)
    expect(isLiveBusy(Date.now() + LIVE_GRACE_MS + 1)).toBe(false)
  })

  it('liveClearItem libera el estado de proyección', () => {
    markLiveActivity('liveStateUpdate', { itemOnLive: { id: '1' }, showLiveScreen: true })
    markLiveActivity('liveClearItem')

    expect(isLiveBusy(Date.now() + LIVE_GRACE_MS + 1)).toBe(false)
  })
})
