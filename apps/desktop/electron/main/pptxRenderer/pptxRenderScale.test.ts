import { describe, expect, it } from 'vitest'
import { PPTX_MAX_SCALE, PPTX_MIN_SCALE, resolveRenderScale } from './pptxRenderScale'

describe('resolveRenderScale', () => {
  it('debería usar la escala mínima cuando no hay pantallas', () => {
    expect(resolveRenderScale(1280, [])).toBe(PPTX_MIN_SCALE)
  })

  it('debería usar la escala mínima en 1080p (1280x720 a 2x ya es 2560x1440)', () => {
    expect(resolveRenderScale(1280, [1920])).toBe(PPTX_MIN_SCALE)
  })

  it('debería bastar 2x en una pantalla de 2560 (2560/1280 es exacto)', () => {
    expect(resolveRenderScale(1280, [1440, 2560])).toBe(2)
  })

  it('debería subir a 3x en cuanto la pantalla supera el doble de la diapositiva', () => {
    expect(resolveRenderScale(1280, [2600])).toBe(3)
  })

  it('debería subir a 3x en 4K con diapositiva de 1280 (ceil(3840/1280))', () => {
    expect(resolveRenderScale(1280, [3840])).toBe(3)
  })

  it('debería subir a 4x cuando la diapositiva es pequeña y la pantalla 4K', () => {
    expect(resolveRenderScale(960, [3840])).toBe(PPTX_MAX_SCALE)
  })

  it('debería tomar la pantalla más ancha, no la primera', () => {
    expect(resolveRenderScale(1280, [1280, 3840, 1920])).toBe(3)
  })

  it('debería topar en la escala máxima aunque la pantalla sea enorme', () => {
    expect(resolveRenderScale(320, [7680])).toBe(PPTX_MAX_SCALE)
  })

  it('debería caer a la escala mínima con anchos inválidos', () => {
    expect(resolveRenderScale(1280, [0])).toBe(PPTX_MIN_SCALE)
    expect(resolveRenderScale(1280, [Number.NaN])).toBe(PPTX_MIN_SCALE)
    expect(resolveRenderScale(0, [3840])).toBe(PPTX_MIN_SCALE)
    expect(resolveRenderScale(Number.NaN, [3840])).toBe(PPTX_MIN_SCALE)
  })
})
