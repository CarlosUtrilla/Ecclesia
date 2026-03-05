type VerseChunk = {
  verse: number
  html: string
}

const BR_SPLIT_REGEX = /<br\s*\/?>/i
const TAG_REGEX = /<[^>]+>/g
const LEADING_VERSE_REGEX = /^\s*(\d+)\.?\s*/

const extractLeadingVerse = (html: string) => {
  const textOnly = html.replace(TAG_REGEX, ' ').trim()
  const match = textOnly.match(LEADING_VERSE_REGEX)
  if (!match?.[1]) return undefined

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

export const splitBibleTextByVerse = (text?: string): VerseChunk[] => {
  if (!text) return []

  return text
    .split(BR_SPLIT_REGEX)
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .reduce<VerseChunk[]>((acc, htmlLine) => {
      const verse = extractLeadingVerse(htmlLine)
      if (verse === undefined) return acc
      acc.push({ verse, html: htmlLine })
      return acc
    }, [])
}

export const getBibleVerseText = (text: string | undefined, verse: number): string | null => {
  const chunks = splitBibleTextByVerse(text)
  const target = chunks.find((chunk) => chunk.verse === verse)
  return target?.html || null
}
