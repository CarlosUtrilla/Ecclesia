/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import {
  getTargetTextStyleFieldPath,
  getTargetTypographyStyle,
  mapTextEffectsUpdatesToTarget
} from './textStyleTarget'

describe('textStyleTarget', () => {
  it('deberia mapear los paths al prefijo verse cuando el target es indicador', () => {
    expect(getTargetTextStyleFieldPath('text', 'fontFamily')).toBe('textStyle.fontFamily')
    expect(getTargetTextStyleFieldPath('verse', 'fontFamily')).toBe('textStyle.verseFontFamily')
  })

  it('deberia resolver fallback para estilo del indicador usando estilo base', () => {
    const style = getTargetTypographyStyle(
      {
        fontFamily: 'Arial',
        color: '#111111',
        fontSize: 40
      },
      'verse'
    )

    expect(style.fontFamily).toBe('Arial')
    expect(style.color).toBe('#111111')
    expect(style.fontSize).toBe(34)
  })

  it('deberia prefijar updates de efectos al target indicador', () => {
    const mapped = mapTextEffectsUpdatesToTarget(
      {
        textShadowEnabled: true,
        textShadowBlur: 6
      },
      'verse'
    )

    expect(mapped).toEqual({
      verseTextShadowEnabled: true,
      verseTextShadowBlur: 6
    })
  })
})
