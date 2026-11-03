import type { BibleReference } from './ai.types'

const normalizeBook = (book: string) => book.trim().toLocaleLowerCase('es')

const lastVerseOf = (ref: BibleReference) => ref.verseEnd ?? ref.verseStart

/**
 * Une referencias que el modelo devolvio partidas ("Juan 15:15", "Juan 15:16"...)
 * aunque el prompt le pide un rango. Solo se unen si son vecinas en el orden del
 * documento: si entre ellas aparece otra referencia (p. ej. un pasaje de Mateo),
 * se predican por separado y deben quedar como entradas distintas.
 */
export function mergeConsecutiveReferences(references: BibleReference[]): BibleReference[] {
  const merged: BibleReference[] = []

  for (const ref of references) {
    const previous = merged[merged.length - 1]
    const isContiguous =
      previous !== undefined &&
      normalizeBook(previous.book) === normalizeBook(ref.book) &&
      previous.chapter === ref.chapter &&
      ref.verseStart >= previous.verseStart &&
      ref.verseStart <= lastVerseOf(previous) + 1

    if (!isContiguous) {
      merged.push({ ...ref })
      continue
    }

    const verseEnd = Math.max(lastVerseOf(previous), lastVerseOf(ref))
    previous.verseEnd = verseEnd > previous.verseStart ? verseEnd : undefined
  }

  return merged
}
