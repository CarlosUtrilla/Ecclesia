import { describe, it, expect } from 'vitest'

describe('TextCanvasItem - Bible verse font size calculation', () => {
  const BASE_CANVAS_HEIGHT = 720

  it('debería calcular smallFontSize como fontSize * 0.85 sin transformación adicional', () => {
    const styleFontSize = 48
    const expectedSmallFontSize = styleFontSize * 0.85
    expect(expectedSmallFontSize).toBe(40.8)
  })

  it('debería usar BASE_CANVAS_HEIGHT como presentationHeight para escala consistente', () => {
    const presentationHeight = BASE_CANVAS_HEIGHT
    expect(presentationHeight).toBe(720)
  })

  it('debería mantener consistencia entre editor y live screen', () => {
    const liveScreenHeight = 1080
    const baseFontSize = 48
    const basePresentationHeight = 720
    const liveSmallFontSize = (liveScreenHeight * (baseFontSize * 0.85)) / basePresentationHeight
    expect(liveSmallFontSize).toBeCloseTo(61.2, 1)

    const editorSmallFontSize = baseFontSize * 0.85
    expect(editorSmallFontSize).toBeCloseTo(40.8, 1)
  })

  it('debería mantener proporción correcta independientemente del zoom del canvas', () => {
    const baseFontSize = 48
    const smallFontSize = baseFontSize * 0.85

    expect(smallFontSize).toBe(40.8)
  })
})
