import { useQuery } from '@tanstack/react-query'

export default function useBibleSchema() {
  const { data: bibleSchema = [] } = useQuery({
    queryKey: ['bibleSchema'],
    queryFn: async () => await window.api.bible.getBibleSchema(),
    staleTime: Infinity
  })

  const getShortNameById = (bookId: number) => {
    const book = bibleSchema.find((b) => b.id === bookId)
    return book ? book.book_id : null
  }

  const getCompleteNameById = (bookId: number) => {
    const book = bibleSchema.find((b) => b.id === bookId)
    return book ? book.book : null
  }

  return {
    bibleSchema,
    getShortNameById,
    getCompleteNameById
  }
}
