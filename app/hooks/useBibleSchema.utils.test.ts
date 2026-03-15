import { describe, expect, it } from 'vitest'
import { findBibleBookByBookId } from './useBibleSchema.utils'

describe('useBibleSchema.utils', () => {
  it('deberia resolver por book_id cuando existe coincidencia', () => {
    const schema = [
      { id: 11, book_id: 1, book: 'Genesis' },
      { id: 12, book_id: 2, book: 'Exodo' }
    ]

    const result = findBibleBookByBookId(schema, 2)

    expect(result?.book).toBe('Exodo')
  })

  it('deberia hacer fallback a id por compatibilidad', () => {
    const schema = [
      { id: 7, book: 'Jueces' },
      { id: 8, book: 'Rut' }
    ]

    const result = findBibleBookByBookId(schema, '8')

    expect(result?.book).toBe('Rut')
  })

  it('deberia retornar null si el id no es numerico o no existe', () => {
    const schema = [{ id: 1, book_id: 1, book: 'Genesis' }]

    expect(findBibleBookByBookId(schema, 'abc')).toBeNull()
    expect(findBibleBookByBookId(schema, 99)).toBeNull()
  })
})
