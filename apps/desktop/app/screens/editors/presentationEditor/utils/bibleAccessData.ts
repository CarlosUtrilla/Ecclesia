export type BibleAccessData = {
  bookId: number
  chapter: number
  verseStart: number
  verseEnd?: number
  version: string
}

export const parseBibleAccessData = (accessData?: string): BibleAccessData => {
  const [bookRaw, chapterRaw, verseRangeRaw, versionRaw] = String(accessData || '').split(',')
  const [verseStartRaw, verseEndRaw] = String(verseRangeRaw || '').split('-')

  return {
    bookId: Number(bookRaw || 43),
    chapter: Number(chapterRaw || 3),
    verseStart: Number(verseStartRaw || 16),
    verseEnd: verseEndRaw ? Number(verseEndRaw) : undefined,
    version: versionRaw || 'RVR1960'
  }
}

export const buildBibleAccessData = (value: BibleAccessData) =>
  `${value.bookId},${value.chapter},${value.verseStart}${value.verseEnd ? `-${value.verseEnd}` : ''},${value.version}`
