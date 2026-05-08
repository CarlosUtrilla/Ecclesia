/* eslint-env vitest */

import { describe, expect, it } from 'vitest'

import { getCustomFontFamily, parseCustomFontVariant } from './customFontUtils'

describe('customFontUtils', () => {
  it('extrae la familia de variantes comunes', () => {
    expect(getCustomFontFamily('Poppins-ExtraLight.ttf')).toBe('Poppins')
    expect(getCustomFontFamily('Poppins-BoldItalic')).toBe('Poppins')
    expect(getCustomFontFamily('BreeSerif-Regular')).toBe('BreeSerif')
  })

  it('infiere peso y estilo desde el nombre', () => {
    expect(parseCustomFontVariant('Poppins-ExtraLightItalic')).toEqual({
      family: 'Poppins',
      weight: 200,
      style: 'italic'
    })

    expect(parseCustomFontVariant('Poppins-Bold')).toEqual({
      family: 'Poppins',
      weight: 700,
      style: 'normal'
    })

    expect(parseCustomFontVariant('BreeSerif-Regular')).toEqual({
      family: 'BreeSerif',
      weight: 400,
      style: 'normal'
    })
  })
})
