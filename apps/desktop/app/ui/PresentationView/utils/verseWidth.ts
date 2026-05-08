export const DEFAULT_BIBLE_VERSE_WIDTH_PERCENT = 100
export const MIN_BIBLE_VERSE_WIDTH_PERCENT = 20

export const clampBibleVerseWidthPercent = (next: number) =>
  Math.min(Math.max(MIN_BIBLE_VERSE_WIDTH_PERCENT, Math.round(next)), DEFAULT_BIBLE_VERSE_WIDTH_PERCENT)

export const resolveBibleVerseWidthPercent = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampBibleVerseWidthPercent(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return clampBibleVerseWidthPercent(parsed)
    }
  }

  return DEFAULT_BIBLE_VERSE_WIDTH_PERCENT
}

export const resolveBibleVerseTranslateX = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return Math.round(parsed)
    }
  }

  return 0
}