import { describe, expect, it } from 'vitest'
import {
  buildBibleSearchPattern,
  escapeLikePattern,
  normalizeBibleSearchText
} from './bibleSearchText'

describe('normalizeBibleSearchText', () => {
  it('deberia pasar a minusculas', () => {
    expect(normalizeBibleSearchText('JESUS')).toBe('jesus')
  })

  it('deberia quitar tildes para que coincida con text_normalized', () => {
    expect(normalizeBibleSearchText('Jesús')).toBe('jesus')
    expect(normalizeBibleSearchText('JESÚS')).toBe('jesus')
    expect(normalizeBibleSearchText('Espíritu')).toBe('espiritu')
  })

  it('deberia convertir la ñ y la diéresis igual que el .ebbl', () => {
    expect(normalizeBibleSearchText('niño')).toBe('nino')
    expect(normalizeBibleSearchText('Señor')).toBe('senor')
    expect(normalizeBibleSearchText('vergüenza')).toBe('verguenza')
  })

  it('deberia recortar espacios sobrantes', () => {
    expect(normalizeBibleSearchText('  Jesús  ')).toBe('jesus')
  })
})

describe('escapeLikePattern', () => {
  it('deberia escapar los comodines de LIKE para buscarlos literales', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%')
    expect(escapeLikePattern('a_b')).toBe('a\\_b')
    expect(escapeLikePattern('c\\d')).toBe('c\\\\d')
  })

  it('no deberia tocar texto sin comodines', () => {
    expect(escapeLikePattern('jesus')).toBe('jesus')
  })
})

describe('buildBibleSearchPattern', () => {
  it('deberia envolver el texto normalizado en comodines', () => {
    expect(buildBibleSearchPattern('Jesús')).toBe('%jesus%')
  })

  it('deberia normalizar y escapar a la vez', () => {
    expect(buildBibleSearchPattern('Amén 100%')).toBe('%amen 100\\%%')
  })
})
