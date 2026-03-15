type BibleSchemaLike = {
  id?: number | string | null
  book_id?: number | string | null
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
