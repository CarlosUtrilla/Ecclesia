import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Button } from '@/ui/button'
import { cn } from '@/lib/utils'
import useBibleSchema from '@/hooks/useBibleSchema'
import BibleVersions from '@/screens/panels/library/bible/bibleVersions'
import VerseSearch from '@/screens/panels/library/bible/verseSearch'

export type BibleTextSelection = {
  bookId: number
  chapter: number
  verseStart: number
  verseEnd?: number
  version: string
  text: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToPresentation: (selection: BibleTextSelection) => void
}

export const scrollToVerseInContainer = (
  verseRefs: Map<number, HTMLDivElement>,
  verseNumber: number
) => {
  const verseElement = verseRefs.get(verseNumber)
  if (!verseElement) return false

  verseElement.scrollIntoView({
    behavior: 'auto',
    block: 'center'
  })

  return true
}

const STORAGE_KEY = 'bible-picker-last-selection'

type BiblePickerPersistedState = {
  version: string
  book: number
  chapter: number
  verseStart: number
  verseEnd: number
}

const DEFAULT_STATE: BiblePickerPersistedState = {
  version: 'RVR1960',
  book: 43,
  chapter: 3,
  verseStart: 16,
  verseEnd: 16
}

function loadLastBiblePickerState(): BiblePickerPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_STATE
  }
}

export default function BibleTextPicker({ open, onOpenChange, onAddToPresentation }: Props) {
  const { bibleSchema } = useBibleSchema()
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [initialState] = useState(() => loadLastBiblePickerState())
  const [selectedVersion, setSelectedVersion] = useState(initialState.version)
  const [selectedBook, setSelectedBook] = useState(initialState.book)
  const [selectedChapter, setSelectedChapter] = useState(initialState.chapter)
  const [selectedVerseStart, setSelectedVerseStart] = useState<number>(initialState.verseStart)
  const [selectedVerseEnd, setSelectedVerseEnd] = useState<number>(initialState.verseEnd)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: selectedVersion,
          book: selectedBook,
          chapter: selectedChapter,
          verseStart: selectedVerseStart,
          verseEnd: selectedVerseEnd
        })
      )
    } catch {
      // localStorage no disponible (modo privado extremo, etc.)
    }
  }, [selectedVersion, selectedBook, selectedChapter, selectedVerseStart, selectedVerseEnd])

  const selectedBookData = useMemo(
    () => bibleSchema.find((book) => book.book_id === selectedBook),
    [bibleSchema, selectedBook]
  )

  const chapters = useMemo(() => {
    if (!selectedBookData) return []
    return Array.from({ length: selectedBookData.chapter.length }, (_, index) => index + 1)
  }, [selectedBookData])

  const { data: completeChapter = [] } = useQuery({
    queryKey: ['presentation-bible-picker', selectedVersion, selectedBook, selectedChapter],
    queryFn: async () =>
      window.api.bible.getCompleteChapter(selectedVersion, selectedBook, selectedChapter),
    enabled: open
  })

  const handleChangeBook = (bookId: number) => {
    setSelectedBook(bookId)
    setSelectedChapter(1)
    setSelectedVerseStart(1)
    setSelectedVerseEnd(1)
  }

  const handleChangeChapter = (chapter: number) => {
    setSelectedChapter(chapter)
    setSelectedVerseStart(1)
    setSelectedVerseEnd(1)
  }

  const handleVerseClick = (verseNumber: number, useRangeExtension = false) => {
    if (useRangeExtension) {
      setSelectedVerseEnd(verseNumber)
      return
    }

    setSelectedVerseStart(verseNumber)
    setSelectedVerseEnd(verseNumber)
  }

  const verseRange = useMemo(() => {
    const start = Math.min(selectedVerseStart, selectedVerseEnd)
    const end = Math.max(selectedVerseStart, selectedVerseEnd)
    return { start, end }
  }, [selectedVerseStart, selectedVerseEnd])

  const selectedVerses = useMemo(
    () =>
      completeChapter.filter(
        (verse) => verse.verse >= verseRange.start && verse.verse <= verseRange.end
      ),
    [completeChapter, verseRange.end, verseRange.start]
  )

  useEffect(() => {
    if (!open || completeChapter.length === 0) return

    requestAnimationFrame(() => {
      scrollToVerseInContainer(verseRefs.current, verseRange.start)
    })
  }, [open, completeChapter, verseRange.start])

  const handleAdd = () => {
    if (selectedVerses.length === 0) return

    const text = selectedVerses.map((verse) => `${verse.verse}. ${verse.text}`).join('<br/>')
    const startVerse = selectedVerses[0].verse
    const endVerse = selectedVerses[selectedVerses.length - 1].verse

    onAddToPresentation({
      bookId: selectedBook,
      chapter: selectedChapter,
      verseStart: startVerse,
      verseEnd: endVerse > startVerse ? endVerse : undefined,
      version: selectedVersion,
      text
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-9/12 h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>Seleccionar texto bíblico</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr]">
          <div className="border-r p-3 flex flex-col gap-3 min-h-0">
            <VerseSearch
              book={selectedBook}
              cap={String(selectedChapter)}
              vers={String(selectedVerseStart || 1)}
              onChaneVerseSearch={(book, cap, vers) => {
                setSelectedBook(book)
                setSelectedChapter(Number(cap || 1))
                const parsedVerse = Number(vers || 1)
                setSelectedVerseStart(parsedVerse)
                setSelectedVerseEnd(parsedVerse)
              }}
            />

            <div className="min-h-0 flex-1">
              <BibleVersions
                selectedVersion={selectedVersion}
                setSelectedVersion={setSelectedVersion}
              />
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="border-b bg-muted/40 px-2 pt-2 pb-2">
              <div className="grid grid-cols-10 text-sm rounded-t-md border border-b-0 bg-background/80">
                <div className="p-2 py-1 col-span-8 font-medium">Libro</div>
                <div className="p-2 py-1 border-l-2 border-border/80 col-span-2 text-center font-medium">
                  Capítulo
                </div>
              </div>
              <div className="grid grid-cols-10 border rounded-b-md text-sm h-56 min-h-56 overflow-hidden bg-background/60">
                <div className="col-span-8 h-full min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {bibleSchema.map((book) => (
                    <div
                      key={book.id}
                      className={cn('p-2 py-1 border-b cursor-pointer hover:bg-muted/40', {
                        'bg-secondary/20 hover:bg-secondary/10': selectedBook === book.book_id
                      })}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChangeBook(book.book_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleChangeBook(book.book_id)
                        }
                      }}
                    >
                      {book.book}
                    </div>
                  ))}
                </div>
                <div className="col-span-2 h-full min-h-0 overflow-y-auto border-l-2 border-border/80 text-center scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {chapters.map((chapter) => (
                    <div
                      key={chapter}
                      className={cn('p-2 py-1 border-b cursor-pointer hover:bg-muted/40', {
                        'bg-secondary/20 hover:bg-secondary/10': selectedChapter === chapter
                      })}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChangeChapter(chapter)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
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

            <div className="flex-1 overflow-y-auto">
              {completeChapter.map((verse) => (
                <div
                  key={verse.verse}
                  ref={(element) => {
                    if (element) {
                      verseRefs.current.set(verse.verse, element)
                    } else {
                      verseRefs.current.delete(verse.verse)
                    }
                  }}
                  className={cn(
                    'flex border-b py-0.5 items-baseline hover:bg-muted/40 cursor-pointer',
                    {
                      'bg-secondary/20 hover:bg-secondary/10':
                        verse.verse >= verseRange.start && verse.verse <= verseRange.end
                    }
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => handleVerseClick(verse.verse, event.shiftKey)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleVerseClick(verse.verse)
                    }
                  }}
                >
                  <div className="font-semibold text-muted-foreground w-8 text-center text-sm select-none">
                    {verse.verse}
                  </div>
                  <div className="flex-1 pr-2 text-sm select-none">{verse.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Versos seleccionados: {selectedBookData?.book || `Libro ${selectedBook}`}{' '}
            {selectedChapter}:{verseRange.start}
            {verseRange.end > verseRange.start ? `-${verseRange.end}` : ''} ({selectedVersion})
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={selectedVerses.length === 0}>
              Agregar a la presentación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
