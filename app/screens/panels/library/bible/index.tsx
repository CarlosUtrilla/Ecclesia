import { cn } from '@/lib/utils'
import { useMemo, useState, useRef, useEffect } from 'react'
import ViewVerses from './viewVerses'
import BibleVersions from './bibleVersions'
import VerseSearch from './verseSearch'
import TextFragmentSearch from './textFragmentSearch'
import useBibleSchema from '@/hooks/useBibleSchema'
import ImportBibleButton from './importBible'
import BiblePresentationConfiguration from '@/screens/editors/biblePresentationConfiguration'
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

  const { bibleSchema } = useBibleSchema()
  const chapters = useMemo(() => {
    const book = bibleSchema.find((b) => b.book_id === selectedBook)
    return book ? Array.from({ length: book.chapter.length }, (_, i) => i + 1) : []
  }, [selectedBook, bibleSchema])

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
    setTimeout(() => {
      const element = bookRefs.current[selectedBook]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }, [selectedBook])

  useEffect(() => {
    setTimeout(() => {
      const element = chapterRefs.current[selectedChapter]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }, [selectedChapter])

  useEffect(() => {
    setTimeout(() => {
      const element = verseRefs.current[selectedVerse[0]]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }, [selectedVerse])

  return (
    <div className="flex w-full !flex-row h-full panel-scrollable">
      {/* Panel de busqueda y seleccion de versiones */}
      <div className="p-2 w-1/5 min-w-sm panel-scrollable border-r">
        <div className="panel-header">
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
          </div>
        </div>
        <div className="panel-scroll-content">
          <BibleVersions
            selectedVersion={selectedVersion}
            setSelectedVersion={setSelectedVersion}
          />
        </div>
        <div className="mt-2 flex gap-2 items-center panel-header">
          <TextFragmentSearch defaultVersion={selectedVersion} />
          <ImportBibleButton />
          <BiblePresentationConfiguration>
            <Button>
              <Settings />
            </Button>
          </BiblePresentationConfiguration>
        </div>
      </div>

      {/* Capitul y vericulo */}
      <div className="overflow-hidden border-b row-span-1 flex flex-col panel-scrollable">
        <div className="bg-muted/40 panel-header">
          <div className="grid border-t grid-cols-10 text-center text-sm">
            <div className="p-2 py-1 col-span-8">Libro</div>
            <div className="p-2 py-1 border-x col-span-2">Capitulo</div>
          </div>
        </div>
        <div
          ref={bookContainerRef}
          className="grid grid-cols-10 text-sm flex-1 panel-scroll-content"
        >
          <div className="overflow-y-auto col-span-8">
            {bibleSchema.map((book) => (
              <div
                key={book.id}
                ref={(el) => {
                  bookRefs.current[book.book_id] = el
                }}
                className={cn('p-2 py-1 border-b cursor-pointer hover:bg-muted/40', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedBook === book.book_id
                })}
                role="button"
                tabIndex={0}
                onClick={() => handleChangeBook(book.book_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleChangeBook(book.book_id)
                  }
                }}
              >
                {book.book}
              </div>
            ))}
          </div>
          <div
            ref={chapterContainerRef}
            className="overflow-y-auto text-center border-x col-span-2"
          >
            {chapters.map((chapter) => (
              <div
                ref={(el) => {
                  chapterRefs.current[chapter] = el
                }}
                key={chapter}
                className={cn('p-2 py-1 border-b hover:bg-muted/40 min-w-12 cursor-default', {
                  'bg-secondary/20 hover:bg-secondary/10': selectedChapter === chapter
                })}
                role="button"
                tabIndex={0}
                onClick={() => handleChangeChapter(chapter)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleChangeChapter(chapter)
                  }
                }}
              >
                {chapter}
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
