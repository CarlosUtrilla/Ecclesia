import { describe, expect, it } from 'vitest'
import {
  buildBibleAccessData,
  parseBibleAccessData,
  parseBibleVerseRange,
  resolveBibleBookAccessId,
  serializeBibleVerseRange
} from './accessData'

describe('bible accessData', () => {
  it('deberia priorizar book_id para el accessData de biblia', () => {
    const result = resolveBibleBookAccessId({ id: 11, book_id: 43 })

    expect(result).toBe(43)
  })

  it('deberia usar id como fallback si no existe book_id', () => {
    const result = resolveBibleBookAccessId({ id: 11 })

    expect(result).toBe(11)
  })

  it('deberia retornar null si no existe ningun id valido', () => {
    expect(resolveBibleBookAccessId(undefined)).toBeNull()
    expect(resolveBibleBookAccessId({ id: 'abc', book_id: null })).toBeNull()
  })

  it('deberia serializar rangos no contiguos en formato compacto', () => {
    expect(serializeBibleVerseRange([1, 2, 3, 8, 12])).toBe('1-3,8,12')
    expect(serializeBibleVerseRange([5, 4, 2, 2, 3, 1])).toBe('1-5')
  })

  it('deberia parsear rangos con segmentos múltiples', () => {
    expect(parseBibleVerseRange('1-3,8,12')).toEqual([1, 2, 3, 8, 12])
    expect(parseBibleVerseRange('10-8,4,4')).toEqual([4, 8, 9, 10])
  })

  it('deberia parsear accessData con rango que incluye comas', () => {
    const parsed = parseBibleAccessData('3,13,1-3,8,12,RVR1960')

    expect(parsed).toEqual({
      bookId: 3,
      chapter: 13,
      verseRange: '1-3,8,12',
      version: 'RVR1960'
    })
  })

  it('deberia reconstruir accessData manteniendo el rango', () => {
    const data = buildBibleAccessData({
      bookId: 3,
      chapter: 13,
      verseRange: '1-3,8,12',
      version: 'RVR1960'
    })

    expect(data).toBe('3,13,1-3,8,12,RVR1960')
  })
})
