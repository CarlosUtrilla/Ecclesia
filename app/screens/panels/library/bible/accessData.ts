type BibleBookLike = {
  id?: number | string | null
  book_id?: number | string | null
}

type BibleAccessDataParts = {
  bookId: number
  chapter: number
  verseRange: string
  version: string
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

function normalizeVerse(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

export function parseBibleVerseRange(range: string): number[] {
  if (!range) return []

  const verses = new Set<number>()
  const segments = String(range)
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  segments.forEach((segment) => {
    if (!segment.includes('-')) {
      const singleVerse = normalizeVerse(segment)
      if (singleVerse !== null) {
        verses.add(singleVerse)
      }
      return
    }

    const [startRaw, endRaw] = segment.split('-').map((value) => value.trim())
    const start = normalizeVerse(startRaw)
    const end = normalizeVerse(endRaw)

    if (start === null || end === null) {
      return
    }

    const min = Math.min(start, end)
    const max = Math.max(start, end)

    for (let verse = min; verse <= max; verse += 1) {
      verses.add(verse)
    }
  })

  return Array.from(verses).sort((a, b) => a - b)
}

export function serializeBibleVerseRange(verses: number[]): string {
  const normalized = Array.from(
    new Set(verses.map((verse) => normalizeVerse(verse)).filter((verse) => verse !== null))
  )
    .map((verse) => verse as number)
    .sort((a, b) => a - b)

  if (normalized.length === 0) {
    return ''
  }

  const chunks: string[] = []
  let rangeStart = normalized[0]
  let previous = normalized[0]

  for (let index = 1; index < normalized.length; index += 1) {
    const current = normalized[index]
    if (current === previous + 1) {
      previous = current
      continue
    }

    chunks.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`)
    rangeStart = current
    previous = current
  }

  chunks.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`)

  return chunks.join(',')
}

export function parseBibleAccessData(accessData?: string): BibleAccessDataParts | null {
  if (!accessData) return null

  const parts = String(accessData).split(',')
  if (parts.length < 4) {
    return null
  }

  const bookId = toValidNumber(parts[0])
  const chapter = toValidNumber(parts[1])
  const version = (parts.at(-1) || 'RVR1960').trim() || 'RVR1960'
  const verseRange = parts
    .slice(2, -1)
    .join(',')
    .trim()

  if (bookId === null || chapter === null || !verseRange) {
    return null
  }

  return {
    bookId,
    chapter,
    verseRange,
    version
  }
}

export function buildBibleAccessData(parts: BibleAccessDataParts): string {
  const version = String(parts.version || 'RVR1960').trim() || 'RVR1960'
  return `${parts.bookId},${parts.chapter},${parts.verseRange},${version}`
}
