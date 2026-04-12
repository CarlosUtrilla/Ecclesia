const MAX_BIBLE_CHUNK_LENGTH = 180
const PUNCTUATION_LOOKAHEAD = 24
const PUNCTUATION_LOOKBEHIND = 24

export const BIBLE_LIVE_SPLIT_MODE_OPTIONS = ['auto', '100', '150', '200', '250'] as const

export type BibleLiveSplitMode = (typeof BIBLE_LIVE_SPLIT_MODE_OPTIONS)[number]

function normalizeBibleText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function parseFontSizeValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace('px', '').trim())
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export function isBibleLiveSplitMode(value: unknown): value is BibleLiveSplitMode {
  if (typeof value !== 'string') return false
  return BIBLE_LIVE_SPLIT_MODE_OPTIONS.includes(value as BibleLiveSplitMode)
}

export function resolveBibleChunkMaxLength(
  mode: BibleLiveSplitMode = 'auto',
  fontSizeValue?: unknown
): number {
  if (mode !== 'auto') {
    return Number(mode)
  }

  const fontSize = parseFontSizeValue(fontSizeValue) ?? 72
  const scaled = Math.round(MAX_BIBLE_CHUNK_LENGTH * (72 / fontSize))
  return Math.max(100, Math.min(250, scaled))
}

function findPreferredPunctuationSplit(text: string, maxLength: number): number | null {
  const minIndex = Math.max(0, maxLength - PUNCTUATION_LOOKBEHIND)
  const maxIndex = Math.min(text.length - 1, maxLength + PUNCTUATION_LOOKAHEAD)
  const punctuationMatches = [...text.matchAll(/[,:;.!?]/g)]

  let bestIndex: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const match of punctuationMatches) {
    const index = match.index
    if (index === undefined) continue
    if (index < minIndex || index > maxIndex) continue

    const distance = Math.abs(index + 1 - maxLength)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index + 1
    }
  }

  return bestIndex
}

function findWordBoundarySplit(text: string, maxLength: number): number {
  if (text.length <= maxLength) return text.length

  const lastWhitespaceBeforeLimit = text.lastIndexOf(' ', maxLength)
  if (lastWhitespaceBeforeLimit > 0) {
    return lastWhitespaceBeforeLimit
  }

  const nextWhitespaceAfterLimit = text.indexOf(' ', maxLength)
  if (nextWhitespaceAfterLimit > 0) {
    return nextWhitespaceAfterLimit
  }

  return text.length
}

function splitSentenceByWords(sentence: string, maxLength: number): string[] {
  const chunks: string[] = []
  let remaining = normalizeBibleText(sentence)

  while (remaining) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    const punctuationSplit = findPreferredPunctuationSplit(remaining, maxLength)
    const splitIndex = punctuationSplit ?? findWordBoundarySplit(remaining, maxLength)
    const currentChunk = normalizeBibleText(remaining.slice(0, splitIndex))

    if (!currentChunk) {
      chunks.push(remaining)
      break
    }

    chunks.push(currentChunk)
    remaining = normalizeBibleText(remaining.slice(splitIndex))
  }

  return chunks
}

function splitBlockIntoChunks(block: string, maxLength: number): string[] {
  if (block.length <= maxLength) {
    return [block]
  }

  const sentences = block.split(/(?<=[.!?;:])\s+/).filter(Boolean)
  if (sentences.length <= 1) {
    return splitSentenceByWords(block, maxLength)
  }

  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const normalizedSentence = normalizeBibleText(sentence)
    if (!normalizedSentence) continue

    const candidate = current ? `${current} ${normalizedSentence}` : normalizedSentence
    if (candidate.length <= maxLength) {
      current = candidate
      continue
    }

    if (current) {
      chunks.push(current)
    }

    if (normalizedSentence.length <= maxLength) {
      current = normalizedSentence
      continue
    }

    const forcedChunks = splitSentenceByWords(normalizedSentence, maxLength)
    chunks.push(...forcedChunks.slice(0, -1))
    current = forcedChunks.at(-1) || ''
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function addContinuityEllipsis(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks

  return chunks.map((chunk, index) => {
    const prefix = index > 0 ? '...' : ''
    const suffix = index < chunks.length - 1 ? '...' : ''
    return `${prefix}${chunk}${suffix}`
  })
}

export function splitLongBibleVerse(text: string, maxLength = MAX_BIBLE_CHUNK_LENGTH): string[] {
  const normalized = normalizeBibleText(text)
  if (!normalized) return []

  if (normalized.length <= maxLength) {
    return [normalized]
  }

  const blocks = normalized
    .split(/<br\s*\/?>|\n+/i)
    .map((block) => normalizeBibleText(block))
    .filter(Boolean)

  const chunks = blocks.flatMap((block) => splitBlockIntoChunks(block, maxLength))
  if (chunks.length === 0) {
    return [normalized]
  }

  return addContinuityEllipsis(chunks)
}

/**
 * Tipo para representar un versículo con sus chunks
 */
export type BibleVerseChunk = {
  book: number
  chapter: number
  verse: number
  content: string[] // Array de chunks del verso (splitteado si es largo)
}

/**
 * Tipo para chunks individuales con toda su metadata
 */
export type BibleChunkWithMetadata = {
  book: number
  chapter: number
  verse: number
  content: string
}

/**
 * Divide un rango de versículos en chunks individuales con metadata
 * Formato del texto: "1 texto verso 1... 2 texto verso 2... 3 texto verso 3..."
 */
export function splitBibleRangeIntoVerses(
  text: string,
  bookId: number,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  maxLength = MAX_BIBLE_CHUNK_LENGTH
): BibleVerseChunk[] {
  const normalized = normalizeBibleText(text)
  if (!normalized) return []

  const result: BibleVerseChunk[] = []

  // Detectar cada versículo por su número al inicio
  // Soporta formatos: "1 texto", "1. texto", "1.) texto"
  const versePattern = /(\d+)\.?\)?\s+/g
  const matches: Array<{ verse: number; start: number; matchLength: number }> = []

  let match: RegExpExecArray | null
  while ((match = versePattern.exec(normalized)) !== null) {
    const verseNum = parseInt(match[1], 10)
    if (verseNum >= verseStart && verseNum <= verseEnd) {
      matches.push({
        verse: verseNum,
        start: match.index + match[0].length, // Posición después del número y espacio
        matchLength: match[0].length
      })
    }
  }

  // Si no encontramos números de verso, tratar como un solo verso
  if (matches.length === 0) {
    const chunks = splitLongBibleVerse(normalized, maxLength)
    return [
      {
        book: bookId,
        chapter,
        verse: verseStart,
        content: chunks
      }
    ]
  }

  // Extraer texto de cada versículo y dividir en chunks
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const next = matches[i + 1]

    // El texto del verso va desde después del número actual hasta el inicio del siguiente número (o final del texto)
    const verseEndPosition = next ? next.start - next.matchLength : normalized.length
    const verseText = normalized.slice(current.start, verseEndPosition).trim()

    if (!verseText) continue

    // Dividir este verso en chunks si es muy largo
    const verseChunks = splitLongBibleVerse(verseText, maxLength)

    result.push({
      book: bookId,
      chapter,
      verse: current.verse,
      content: verseChunks
    })
  }

  return result
}

/**
 * Aplana la estructura de versículos en un array de chunks con metadata completa.
 * Cada chunk contiene su texto + información del verso al que pertenece.
 */
export function flattenVerseChunks(verses: BibleVerseChunk[]): BibleChunkWithMetadata[] {
  const chunks: BibleChunkWithMetadata[] = []

  for (const verse of verses) {
    for (const chunkContent of verse.content) {
      chunks.push({
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        content: chunkContent
      })
    }
  }

  return chunks
}

export { MAX_BIBLE_CHUNK_LENGTH }
