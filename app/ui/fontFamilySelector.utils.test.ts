/* eslint-env vitest */

import { describe, expect, it } from 'vitest'

import {
  buildGroupedCustomFontOptions,
  resolveSelectedCustomFontValue,
  type CustomFontLike
} from './fontFamilySelector.utils'

describe('fontFamilySelector.utils', () => {
  it('agrupa variantes por familia y usa la familia como valor', () => {
    const fonts: CustomFontLike[] = [
      { id: 1, name: 'Poppins-ExtraLight', fileName: 'Poppins-ExtraLight.ttf' },
      { id: 2, name: 'Poppins-Bold', fileName: 'Poppins-Bold.ttf' },
      { id: 3, name: 'Poppins-Regular', fileName: 'Poppins-Regular.ttf' },
      { id: 4, name: 'BreeSerif-Regular', fileName: 'BreeSerif-Regular.ttf' }
    ]

    const grouped = buildGroupedCustomFontOptions(fonts)

    expect(grouped).toHaveLength(2)

    const poppins = grouped.find((g) => g.label === 'Poppins')
    expect(poppins).toBeDefined()
    expect(poppins?.variantCount).toBe(3)
    expect(poppins?.value).toBe('Poppins')

    const bree = grouped.find((g) => g.label === 'BreeSerif')
    expect(bree).toBeDefined()
    expect(bree?.variantCount).toBe(1)
  })

  it('mapea un valor antiguo de variante al valor de su familia', () => {
    const grouped = buildGroupedCustomFontOptions([
      { id: 1, name: 'Poppins-ExtraLight', fileName: 'Poppins-ExtraLight.ttf' },
      { id: 2, name: 'Poppins-Regular', fileName: 'Poppins-Regular.ttf' }
    ])

    const resolved = resolveSelectedCustomFontValue('Poppins-ExtraLight', grouped)
    expect(resolved).toBe('Poppins')
  })
})
