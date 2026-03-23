import { describe, expect, it } from 'vitest'
import { getTextResizeBehavior, shouldScaleTextFontOnResize } from './useCanvasTransform'

describe('useCanvasTransform resize behavior', () => {
  it('deberia escalar texto sin Shift y preservar aspecto', () => {
    const behavior = getTextResizeBehavior('TEXT', false)

    expect(behavior.preserveAspectRatio).toBe(true)
    expect(behavior.scaleFontSizeWithResize).toBe(true)
  })

  it('deberia hacer resize libre de texto con Shift', () => {
    const behavior = getTextResizeBehavior('TEXT', true)

    expect(behavior.preserveAspectRatio).toBe(false)
    expect(behavior.scaleFontSizeWithResize).toBe(false)
  })

  it('deberia mantener comportamiento tradicional para media', () => {
    const withoutShift = getTextResizeBehavior('MEDIA', false)
    const withShift = getTextResizeBehavior('MEDIA', true)

    expect(withoutShift.preserveAspectRatio).toBe(false)
    expect(withoutShift.scaleFontSizeWithResize).toBe(false)
    expect(withShift.preserveAspectRatio).toBe(true)
    expect(withShift.scaleFontSizeWithResize).toBe(false)
  })

  it('deberia tratar handles laterales de texto como especiales (sin escalar fontSize)', () => {
    expect(shouldScaleTextFontOnResize('TEXT', false, 'left')).toBe(false)
    expect(shouldScaleTextFontOnResize('TEXT', false, 'right')).toBe(false)
    expect(shouldScaleTextFontOnResize('TEXT', false, 'top')).toBe(false)
    expect(shouldScaleTextFontOnResize('TEXT', false, 'bottom')).toBe(false)
    expect(shouldScaleTextFontOnResize('TEXT', false, 'bottom-right')).toBe(true)
  })
})
