import { describe, expect, it } from 'vitest'
import { findBibleBookByBookId, resolveBibleBookName } from './useBibleSchema.utils'

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

describe('resolveBibleBookName', () => {
  const schema = [
    { id: 58, book_id: 58, book: 'Hebreos', book_short: 'Heb' },
    { id: 59, book_id: 59, book: 'Santiago', book_short: '' }
  ]

  it('deberia devolver la abreviatura en modo corto, nunca el id numerico', () => {
    expect(resolveBibleBookName(schema, 58, 'short')).toBe('Heb')
  })

  it('deberia devolver el nombre completo en modo completo', () => {
    expect(resolveBibleBookName(schema, 58, 'complete')).toBe('Hebreos')
  })

  it('deberia caer al nombre completo cuando la biblia no trae abreviatura', () => {
    expect(resolveBibleBookName(schema, 59, 'short')).toBe('Santiago')
  })

  it('deberia devolver null cuando el libro no existe en el esquema', () => {
    expect(resolveBibleBookName(schema, 99, 'short')).toBeNull()
    expect(resolveBibleBookName(schema, 99, 'complete')).toBeNull()
  })
})
