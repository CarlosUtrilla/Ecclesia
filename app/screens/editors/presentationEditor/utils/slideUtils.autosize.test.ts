// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { getAutoSizedTextStyle } from './slideUtils'

describe('getAutoSizedTextStyle', () => {
  it('deberia ajustar ancho y alto al contenido para texto nuevo', () => {
    const style = getAutoSizedTextStyle('Hola', {
      fontSize: 48,
      fontFamily: 'Arial',
      lineHeight: 1.2,
      letterSpacing: 0,
      width: 920,
      height: 220
    })

    expect(style.width).toBeLessThan(920)
    expect(style.width).toBeGreaterThanOrEqual(80)
    expect(style.height).toBeGreaterThanOrEqual(60)
    expect(style.height).toBeLessThanOrEqual(220)
  })
})
