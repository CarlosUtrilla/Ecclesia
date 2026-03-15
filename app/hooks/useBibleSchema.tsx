import { useQuery } from '@tanstack/react-query'
import { findBibleBookByBookId } from './useBibleSchema.utils'

export default function useBibleSchema() {
  const { data: bibleSchema = [] } = useQuery({
    queryKey: ['bibleSchema'],
    queryFn: async () => await window.api.bible.getBibleSchema(),
    staleTime: Infinity
  })

  const findBookById = (bookId: number | string) => {
    return findBibleBookByBookId(bibleSchema, bookId)
  }

  const getShortNameById = (bookId: number) => {
    const book = findBookById(bookId)
    return book ? book.book_id : null
  }

  const getCompleteNameById = (bookId: number) => {
    const book = findBookById(bookId)
    return book ? book.book : null
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
