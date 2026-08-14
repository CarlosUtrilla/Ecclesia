import type { BibleDTO } from '@ecclesia/api/src/controllers/bible/bible.dto'

export type BibleSearchRow =
  | { kind: 'book'; key: string; book: string; count: number }
  | { kind: 'verse'; key: string; verse: BibleDTO }

/**
 * Aplana los resultados de búsqueda en filas para el virtualizador: una fila de
 * cabecera por libro seguida de sus versículos. La consulta ya viene ordenada por
 * `book_id, chapter, verse`, así que basta con cortar cada vez que cambia el libro.
 */
export function groupBibleSearchResultsByBook(results: BibleDTO[]): BibleSearchRow[] {
  const rows: BibleSearchRow[] = []
  let currentBookKey: string | null = null
  let currentHeader: Extract<BibleSearchRow, { kind: 'book' }> | null = null

  for (const verse of results) {
    const bookKey = String(verse.book_id ?? verse.book)

    if (bookKey !== currentBookKey) {
      currentBookKey = bookKey
      currentHeader = { kind: 'book', key: `book-${bookKey}`, book: verse.book, count: 0 }
      rows.push(currentHeader)
    }

    currentHeader!.count += 1
    rows.push({
      kind: 'verse',
      key: `verse-${bookKey}-${verse.chapter}-${verse.verse}`,
      verse
    })
  }

  return rows
}

export function countBibleSearchBooks(rows: BibleSearchRow[]): number {
  return rows.reduce((total, row) => (row.kind === 'book' ? total + 1 : total), 0)
}

/**
 * Cabecera del libro al que pertenece la fila visible, para la cabecera fija del scroll.
 * Retrocede hasta la primera fila `book` porque toda fila `verse` va precedida de la suya.
 */
export function findBookHeaderForIndex(
  rows: BibleSearchRow[],
  index: number
): Extract<BibleSearchRow, { kind: 'book' }> | null {
  for (let i = Math.min(index, rows.length - 1); i >= 0; i--) {
    const row = rows[i]
    if (row.kind === 'book') return row
  }

  return null
}
