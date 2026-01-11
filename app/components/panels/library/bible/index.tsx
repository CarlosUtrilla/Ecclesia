import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import ViewVerses from './viewVerses'

export default function BiblePanel() {
  const [selectedBook, setSelectedBook] = useState('GEN')
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [selectedVerse, setSelectedVerse] = useState([1])
  const { data: bibleSchema = [] } = useQuery({
    queryKey: ['bibleSchema'],
    queryFn: async () => await window.api.bible.getBibleSchema(),
    staleTime: Infinity
  })
  const chapters = useMemo(() => {
    const book = bibleSchema.find((b) => b.book_id === selectedBook)
    return book ? Array.from({ length: book.chapter.length + 1 }, (_, i) => i + 1) : []
  }, [selectedBook, bibleSchema])

  const verses = useMemo(() => {
    const book = bibleSchema.find((b) => b.book_id === selectedBook)
    if (!book) return []
    const chapter = book.chapter.find((c) => c.chapter === selectedChapter)
    return chapter ? Array.from({ length: chapter.verses + 1 }, (_, i) => i + 1) : []
  }, [selectedBook, selectedChapter, bibleSchema])

  const selectedBookData = useMemo(
    () => bibleSchema.find((b) => b.book_id === selectedBook),
    [selectedBook, bibleSchema]
  )

  const handleChangeBook = (bookId: string) => {
    setSelectedBook(bookId)
    setSelectedChapter(1)
    setSelectedVerse([1])
  }

  const handleChangeChapter = (chapter: number) => {
    setSelectedChapter(chapter)
    setSelectedVerse([1])
  }

  return (
    <div className="grid grid-rows-2 h-full">
      <div className="overflow-hidden border-b row-span-1">
        <div className="grid grid-cols-12 text-center text-sm bg-muted/40">
          <div className="p-2 col-span-8">Libro</div>
          <div className="p-2 border-x col-span-2">Cap.</div>
          <div className="p-2 col-span-2">Vers.</div>
        </div>
        <div className="grid grid-cols-12 h-full">
          <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent col-span-8">
            {bibleSchema.map((book) => (
              <div
                key={book.id}
                className={cn('p-2 py-1 border-b cursor-pointer hover:bg-muted/40', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedBook === book.book_id
                })}
                onClick={() => handleChangeBook(book.book_id)}
              >
                {book.book}
              </div>
            ))}
          </div>
          <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent text-center border-x col-span-2">
            {chapters.map((chapter) => (
              <div
                key={chapter}
                className={cn('p-2 py-1 border-b hover:bg-muted/40 cursor-default', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedChapter === chapter
                })}
                onClick={() => handleChangeChapter(chapter)}
              >
                {chapter}
              </div>
            ))}
          </div>
          <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent text-center col-span-2">
            {verses.map((verse) => (
              <div
                key={verse}
                className={cn('p-2 py-1 border-b hover:bg-muted/40 cursor-default', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedVerse.includes(verse)
                })}
                onClick={() => setSelectedVerse([verse])}
              >
                {verse}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ViewVerses
        bookData={selectedBookData}
        version="RVR1960"
        book={selectedBook}
        chapter={selectedChapter}
        verse={selectedVerse}
        setSelectedVerse={setSelectedVerse}
      />
    </div>
  )
}
