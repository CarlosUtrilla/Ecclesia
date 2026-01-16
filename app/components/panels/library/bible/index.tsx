import { cn } from '@/lib/utils'
import { useMemo, useState, useRef, useEffect } from 'react'
import ViewVerses from './viewVerses'
import BibleVersions from './bibleVersions'
import VerseSearch from './verseSearch'
import TextFragmentSearch from './textFragmentSearch'
import useBibleSchema from '@/hooks/useBibleSchema'
import ImportBibleButton from './importBible'
import BiblePresentationConfiguration from '@/components/biblePresentationConfiguration'
import { Button } from '@/ui/button'
import { Settings } from 'lucide-react'

export default function BiblePanel() {
  const [selectedVersion, setSelectedVersion] = useState('RVR1960')
  const [selectedBook, setSelectedBook] = useState(1)
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [selectedVerse, setSelectedVerse] = useState([1])

  const bookRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const chapterRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const verseRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  const bookContainerRef = useRef<HTMLDivElement>(null)
  const chapterContainerRef = useRef<HTMLDivElement>(null)
  const verseContainerRef = useRef<HTMLDivElement>(null)

  const { bibleSchema } = useBibleSchema()
  const chapters = useMemo(() => {
    const book = bibleSchema.find((b) => b.book_id === selectedBook)
    return book ? Array.from({ length: book.chapter.length }, (_, i) => i + 1) : []
  }, [selectedBook, bibleSchema])

  const verses = useMemo(() => {
    const book = bibleSchema.find((b) => b.book_id === selectedBook)
    if (!book) return []
    const chapter = book.chapter.find((c) => c.chapter === selectedChapter)
    return chapter ? Array.from({ length: chapter.verses }, (_, i) => i + 1) : []
  }, [selectedBook, selectedChapter, bibleSchema])

  const selectedBookData = useMemo(
    () => bibleSchema.find((b) => b.book_id === selectedBook),
    [selectedBook, bibleSchema]
  )

  const handleChangeBook = (bookId: number) => {
    setSelectedBook(bookId)
    setSelectedChapter(1)
    setSelectedVerse([1])
  }

  const handleChangeChapter = (chapter: number) => {
    setSelectedChapter(chapter)
    setSelectedVerse([1])
  }

  useEffect(() => {
    const element = bookRefs.current[selectedBook]
    const container = bookContainerRef.current
    if (element && container) {
      const elementTop = element.offsetTop
      const elementHeight = element.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2
      container.scrollTo({ top: scrollTo, behavior: 'instant' })
    }
  }, [selectedBook])

  useEffect(() => {
    const element = chapterRefs.current[selectedChapter]
    const container = chapterContainerRef.current
    if (element && container) {
      const elementTop = element.offsetTop
      const elementHeight = element.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2
      container.scrollTo({ top: scrollTo, behavior: 'instant' })
    }
  }, [selectedChapter])

  useEffect(() => {
    const element = verseRefs.current[selectedVerse[0]]
    const container = verseContainerRef.current
    if (element && container) {
      const elementTop = element.offsetTop
      const elementHeight = element.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2
      container.scrollTo({ top: scrollTo, behavior: 'instant' })
    }
  }, [selectedVerse])

  return (
    <div className="grid grid-rows-2 h-full">
      <div className="overflow-hidden border-b row-span-1 flex flex-col">
        <div className="bg-muted/40">
          <div className="p-2">
            <div className="mb-2 flex items-center gap-1">
              <VerseSearch
                book={selectedBook}
                cap={selectedChapter.toString()}
                vers={selectedVerse[0].toString()}
                onChaneVerseSearch={(book, cap, vers) => {
                  setSelectedBook(book)
                  setSelectedChapter(parseInt(cap))
                  setSelectedVerse([parseInt(vers)])
                }}
              />
              <ImportBibleButton />
              <BiblePresentationConfiguration>
                <Button>
                  <Settings />
                </Button>
              </BiblePresentationConfiguration>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <BibleVersions
                selectedVersion={selectedVersion}
                setSelectedVersion={setSelectedVersion}
              />
              <TextFragmentSearch defaultVersion={selectedVersion} />
            </div>
          </div>
          <div className="grid border-t grid-cols-12 text-center text-sm">
            <div className="p-2 py-1 col-span-8">Libro</div>
            <div className="p-2 py-1 border-x col-span-2">Cap.</div>
            <div className="p-2 py-1 col-span-2">Vers.</div>
          </div>
        </div>
        <div className="grid grid-cols-12 text-sm flex-1 min-h-0">
          <div
            ref={bookContainerRef}
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent col-span-8"
          >
            {bibleSchema.map((book) => (
              <div
                key={book.id}
                ref={(el) => {
                  bookRefs.current[book.book_id] = el
                }}
                className={cn('p-2 py-1 border-b cursor-pointer hover:bg-muted/40', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedBook === book.book_id
                })}
                onClick={() => handleChangeBook(book.book_id)}
              >
                {book.book}
              </div>
            ))}
          </div>
          <div
            ref={chapterContainerRef}
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent text-center border-x col-span-2"
          >
            {chapters.map((chapter) => (
              <div
                ref={(el) => {
                  chapterRefs.current[chapter] = el
                }}
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
          <div
            ref={verseContainerRef}
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent text-center col-span-2"
          >
            {verses.map((verse) => (
              <div
                ref={(el) => {
                  verseRefs.current[verse] = el
                }}
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
        version={selectedVersion}
        book={selectedBook}
        chapter={selectedChapter}
        verse={selectedVerse}
        setSelectedVerse={setSelectedVerse}
      />
    </div>
  )
}
