import { describe, expect, it } from 'vitest'
import {
  clampTimerThresholdSeconds,
  resolveTimerThresholdUnit,
  toTimerThresholdDisplayValue,
  toTimerThresholdSeconds
} from './timerThreshold.utils'

describe('timerThreshold.utils', () => {
  it('deberia resolver unidad minutos para valores divisibles por 60', () => {
    expect(resolveTimerThresholdUnit(120)).toBe('minutes')
  })

  it('deberia resolver unidad segundos para valores no divisibles por 60', () => {
    expect(resolveTimerThresholdUnit(90)).toBe('seconds')
  })

  it('deberia convertir a valor mostrado en minutos', () => {
    expect(toTimerThresholdDisplayValue(180, 'minutes')).toBe(3)
  })

  it('deberia convertir minutos a segundos para persistencia', () => {
    expect(toTimerThresholdSeconds(5, 'minutes')).toBe(300)
  })

  it('deberia clampear el umbral maximo a 3600 segundos', () => {
    expect(clampTimerThresholdSeconds(9999)).toBe(3600)
    expect(toTimerThresholdSeconds(80, 'minutes')).toBe(3600)
  })
})
