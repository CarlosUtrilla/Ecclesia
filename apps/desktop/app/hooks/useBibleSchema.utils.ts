type BibleSchemaLike = {
  id?: number | string | null
  book_id?: number | string | null
  book?: string | null
  book_short?: string | null
}

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function findBibleBookByBookId<T extends BibleSchemaLike>(
  bibleSchema: T[],
  bookId: number | string
): T | null {
  const normalizedBookId = toFiniteNumber(bookId)
  if (normalizedBookId === null) return null

  const byBookId =
    bibleSchema.find((book) => toFiniteNumber(book.book_id) === normalizedBookId) ?? null

  if (byBookId) return byBookId

  return bibleSchema.find((book) => toFiniteNumber(book.id) === normalizedBookId) ?? null
}

/**
 * Nombre visible del libro segun el modo de descripcion configurado.
 * `book_id` es el id numerico del libro, nunca la abreviatura: el modo corto
 * usa `book_short` y cae al nombre completo si la biblia no trae abreviatura.
 */
export function resolveBibleBookName(
  bibleSchema: BibleSchemaLike[],
  bookId: number | string,
  mode: 'short' | 'complete'
): string | null {
  const book = findBibleBookByBookId(bibleSchema, bookId)
  if (!book) return null

  if (mode === 'complete') return book.book || null

  return book.book_short || book.book || null
}
