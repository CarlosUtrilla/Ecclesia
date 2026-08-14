import { useQuery } from '@tanstack/react-query'
import { findBibleBookByBookId, resolveBibleBookName } from './useBibleSchema.utils'
import { Api } from '@ecclesia/queries'

export default function useBibleSchema() {
  const { data: bibleSchema = [] } = useQuery({
    ...Api.query.bible.getBibleSchema(),
    staleTime: Infinity
  })

  const findBookById = (bookId: number | string) => {
    return findBibleBookByBookId(bibleSchema, bookId)
  }

  const getShortNameById = (bookId: number) => {
    return resolveBibleBookName(bibleSchema, bookId, 'short')
  }

  const getCompleteNameById = (bookId: number) => {
    return resolveBibleBookName(bibleSchema, bookId, 'complete')
  }

  const getCompleteVerseText = (
    bookId: number,
    chapter: number,
    verseStart: number,
    verseEnd?: number
  ) => {
    const book = findBookById(bookId)
    if (!book) return null
    return `${book.book} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ''}`
  }

  return {
    bibleSchema,
    getShortNameById,
    getCompleteNameById,
    getCompleteVerseText
  }
}
