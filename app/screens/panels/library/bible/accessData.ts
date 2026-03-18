type BibleBookLike = {
  id?: number | string | null
  book_id?: number | string | null
}

function toValidNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveBibleBookAccessId(bookData?: BibleBookLike): number | null {
  const normalizedBookId = toValidNumber(bookData?.book_id)
  if (normalizedBookId !== null) {
    return normalizedBookId
  }

  const fallbackId = toValidNumber(bookData?.id)
  if (fallbackId !== null) {
    return fallbackId
  }

  return null
}
