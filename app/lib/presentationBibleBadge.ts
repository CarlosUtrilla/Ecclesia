type BibleBookSchemaLike = {
  id?: number | string | null
  book_id?: number | string | null
  book_short?: string | null
  book?: string | null
}

type BuildPresentationBibleBadgeLabelParams = {
  bookShortName: string
  chapter: number
  rangeStart: number
  rangeEnd: number
  currentVerse?: number
}

const toNumericId = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const resolvePresentationBookShortName = (
  bookId: number,
  bibleSchema: BibleBookSchemaLike[]
): string => {
  const foundBook = bibleSchema.find((book) => {
    const byId = toNumericId(book.id)
    const byBookId = toNumericId(book.book_id)
    return byId === bookId || byBookId === bookId
  })

  if (!foundBook) return String(bookId)

  return String(foundBook.book_short || foundBook.book_id || foundBook.book)
}

export const buildPresentationBibleBadgeLabel = ({
  bookShortName,
  chapter,
  rangeStart,
  rangeEnd,
  currentVerse
}: BuildPresentationBibleBadgeLabelParams): string => {
  const boundedCurrent =
    currentVerse !== undefined ? Math.max(rangeStart, Math.min(rangeEnd, currentVerse)) : rangeStart

  const versePart = boundedCurrent === rangeEnd ? `${boundedCurrent}` : `${boundedCurrent}-${rangeEnd}`

  return `${bookShortName} ${chapter}:${versePart}`
}
