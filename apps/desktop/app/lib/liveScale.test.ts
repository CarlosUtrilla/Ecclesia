import { describe, it, expect } from 'vitest'
import { scaleLivePx } from './liveScale'
import { BASE_PRESENTATION_HEIGHT } from './themeConstants'

describe('scaleLivePx', () => {
  it('debería devolver el valor base cuando el contenedor mide la altura de referencia', () => {
    expect(scaleLivePx(120, BASE_PRESENTATION_HEIGHT)).toBe(120)
  })

  it('debería escalar proporcionalmente cuando el contenedor es más grande', () => {
    // Doble de altura => doble de px
    expect(scaleLivePx(120, BASE_PRESENTATION_HEIGHT * 2)).toBe(240)
  })

  it('debería escalar proporcionalmente cuando el contenedor es más pequeño', () => {
    expect(scaleLivePx(120, BASE_PRESENTATION_HEIGHT / 2)).toBe(60)
  })

  it('debería respetar una altura de referencia personalizada', () => {
    expect(scaleLivePx(10, 2000, 1000)).toBe(20)
  })

  it('debería devolver el valor base ante alturas de contenedor inválidas', () => {
    expect(scaleLivePx(120, 0)).toBe(120)
    expect(scaleLivePx(120, -50)).toBe(120)
    expect(scaleLivePx(120, Number.NaN)).toBe(120)
    expect(scaleLivePx(120, Number.POSITIVE_INFINITY)).toBe(120)
  })

  it('debería devolver el valor base ante una referencia inválida', () => {
    expect(scaleLivePx(120, 640, 0)).toBe(120)
    expect(scaleLivePx(120, 640, -1)).toBe(120)
  })
})
