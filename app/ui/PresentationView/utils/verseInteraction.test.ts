/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { canProcessVerseDragMove, hasMeaningfulVerseDrag } from './verseInteraction'

describe('verseInteraction', () => {
  it('deberia ignorar micro movimientos al arrastrar el indicador', () => {
    expect(hasMeaningfulVerseDrag(0)).toBe(false)
    expect(hasMeaningfulVerseDrag(1.9)).toBe(false)
    expect(hasMeaningfulVerseDrag(-1.5)).toBe(false)
  })

  it('deberia aceptar movimientos reales por encima del umbral', () => {
    expect(hasMeaningfulVerseDrag(2)).toBe(true)
    expect(hasMeaningfulVerseDrag(-2.1)).toBe(true)
  })

  it('solo deberia procesar drag si el botón primario sigue presionado', () => {
    expect(canProcessVerseDragMove(0)).toBe(false)
    expect(canProcessVerseDragMove(1)).toBe(true)
    expect(canProcessVerseDragMove(2)).toBe(false)
  })
})
