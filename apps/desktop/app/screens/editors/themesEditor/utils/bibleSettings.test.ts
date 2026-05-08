/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { clampBibleEdgeOffset, shouldDetachDefaultBibleSettings } from './bibleSettings'

describe('bibleSettings utils', () => {
  it('deberia limitar el offset bíblico al rango permitido', () => {
    expect(clampBibleEdgeOffset(-4)).toBe(0)
    expect(clampBibleEdgeOffset(10.6)).toBe(11)
    expect(clampBibleEdgeOffset(120)).toBe(72)
  })

  it('solo deberia desacoplar de default cuando el valor realmente cambia', () => {
    expect(shouldDetachDefaultBibleSettings(true, 10, 10)).toBe(false)
    expect(shouldDetachDefaultBibleSettings(true, 10, 11)).toBe(true)
    expect(shouldDetachDefaultBibleSettings(false, 10, 11)).toBe(false)
  })
})
