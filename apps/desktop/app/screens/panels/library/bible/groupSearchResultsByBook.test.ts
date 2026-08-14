import { describe, expect, it } from 'vitest'
import type { BibleDTO } from '@ecclesia/api/src/controllers/bible/bible.dto'
import {
  countBibleSearchBooks,
  findBookHeaderForIndex,
  groupBibleSearchResultsByBook
} from './groupSearchResultsByBook'

const verse = (
  book: string,
  bookId: number,
  chapter: number,
  verseNumber: number
): BibleDTO =>
  ({
    id: bookId * 10000 + chapter * 100 + verseNumber,
    book,
    book_id: String(bookId),
    book_short: book.slice(0, 3),
    testament: 'New',
    chapter,
    verse: verseNumber,
    text: `texto ${book} ${chapter}:${verseNumber}`,
    text_normalized: `texto ${book} ${chapter}:${verseNumber}`
  }) as BibleDTO

describe('groupBibleSearchResultsByBook', () => {
  it('deberia insertar una cabecera antes de los versiculos de cada libro', () => {
    const rows = groupBibleSearchResultsByBook([
      verse('Mateo', 40, 1, 16),
      verse('Mateo', 40, 2, 1),
      verse('Lucas', 42, 2, 21)
    ])

    expect(rows.map((row) => (row.kind === 'book' ? `# ${row.book}` : row.verse.text))).toEqual([
      '# Mateo',
      'texto Mateo 1:16',
      'texto Mateo 2:1',
      '# Lucas',
      'texto Lucas 2:21'
    ])
  })

  it('deberia contar las coincidencias de cada libro en su cabecera', () => {
    const rows = groupBibleSearchResultsByBook([
      verse('Mateo', 40, 1, 16),
      verse('Mateo', 40, 2, 1),
      verse('Lucas', 42, 2, 21)
    ])

    const headers = rows.filter((row) => row.kind === 'book')

    expect(headers).toEqual([
      { kind: 'book', key: 'book-40', book: 'Mateo', count: 2 },
      { kind: 'book', key: 'book-42', book: 'Lucas', count: 1 }
    ])
  })

  it('deberia generar keys estables y unicas por fila', () => {
    const rows = groupBibleSearchResultsByBook([
      verse('Mateo', 40, 1, 16),
      verse('Mateo', 40, 2, 1),
      verse('Lucas', 42, 2, 21)
    ])

    const keys = rows.map((row) => row.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('deberia devolver una lista vacia sin resultados', () => {
    expect(groupBibleSearchResultsByBook([])).toEqual([])
  })
})

describe('countBibleSearchBooks', () => {
  it('deberia contar solo las cabeceras', () => {
    const rows = groupBibleSearchResultsByBook([
      verse('Mateo', 40, 1, 16),
      verse('Mateo', 40, 2, 1),
      verse('Lucas', 42, 2, 21)
    ])

    expect(countBibleSearchBooks(rows)).toBe(2)
  })

  it('deberia devolver 0 sin resultados', () => {
    expect(countBibleSearchBooks([])).toBe(0)
  })
})

describe('findBookHeaderForIndex', () => {
  // [0] Mateo, [1] 1:16, [2] 2:1, [3] Lucas, [4] 2:21
  const rows = groupBibleSearchResultsByBook([
    verse('Mateo', 40, 1, 16),
    verse('Mateo', 40, 2, 1),
    verse('Lucas', 42, 2, 21)
  ])

  it('deberia devolver la cabecera del libro del versiculo visible', () => {
    expect(findBookHeaderForIndex(rows, 2)?.book).toBe('Mateo')
    expect(findBookHeaderForIndex(rows, 4)?.book).toBe('Lucas')
  })

  it('deberia devolver la propia cabecera cuando el indice ya es una', () => {
    expect(findBookHeaderForIndex(rows, 0)?.book).toBe('Mateo')
    expect(findBookHeaderForIndex(rows, 3)?.book).toBe('Lucas')
  })

  it('deberia acotar indices fuera de rango a la ultima fila', () => {
    expect(findBookHeaderForIndex(rows, 99)?.book).toBe('Lucas')
  })

  it('deberia devolver null sin filas', () => {
    expect(findBookHeaderForIndex([], 0)).toBeNull()
  })
})
