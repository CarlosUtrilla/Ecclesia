import useBibleSchema from '@/hooks/useBibleSchema'
import { cn } from '@/lib/utils'
import React, { useState, useCallback } from 'react'

type Props = {
  book: string
  cap: string
  vers: string
  onChaneVerseSearch: (book: string, cap: string, vers: string) => void
}

export default function VerseSearch({
  book: initialBook,
  cap: initialCap,
  vers: initialVers,
  onChaneVerseSearch
}: Props) {
  const inputContainerRef = React.useRef<HTMLDivElement>(null)
  const inputBookRef = React.useRef<HTMLInputElement>(null)
  const inputCapRef = React.useRef<HTMLInputElement>(null)
  const inputVersRef = React.useRef<HTMLInputElement>(null)

  const { bibleSchema = [] } = useBibleSchema()

  const [isFocused, setIsFocused] = useState(false)
  const [book, setBook] = useState(
    initialBook ? bibleSchema.find((b) => b.book_id === initialBook)?.book || '' : ''
  )
  const [cap, setCap] = useState(initialCap)
  const [vers, setVers] = useState(initialVers)

  const showShakeAnimation = useCallback(() => {
    inputContainerRef.current?.classList.add('animate-shake')
    setTimeout(() => inputContainerRef.current?.classList.remove('animate-shake'), 500)
  }, [])

  const handleBookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const coincidences = bibleSchema.filter((b) =>
      b.book.toLowerCase().startsWith(e.target.value.toLowerCase())
    )

    if (coincidences.length === 0) {
      showShakeAnimation()
      setBook('')
    } else if (coincidences.length === 1) {
      setBook(coincidences[0].book)
      setCap('')
      setVers('')
      inputCapRef.current?.focus()
    } else {
      setBook(e.target.value)
    }
  }

  const handleCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedBook = bibleSchema.find((b) => b.book === book)
    if (!selectedBook) return

    const capNumber = parseInt(e.target.value)
    if (isNaN(capNumber) || !selectedBook.chapter.some((c) => c.chapter === capNumber)) {
      showShakeAnimation()
      setCap('')
      return
    }

    const coincidences = selectedBook.chapter.filter((c) =>
      c.chapter.toString().startsWith(e.target.value)
    )

    if (coincidences.length === 1) {
      setCap(coincidences[0].chapter.toString())
      setVers('')
      inputVersRef.current?.focus()
    } else {
      setCap(e.target.value)
    }
  }

  const handleVersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedBook = bibleSchema.find((b) => b.book === book)
    if (!selectedBook) return

    const selectedChapter = selectedBook.chapter.find((c) => c.chapter === parseInt(cap))
    if (!selectedChapter) return

    const versNumber = parseInt(e.target.value)
    if (isNaN(versNumber) || versNumber < 1 || versNumber > selectedChapter.verses) {
      showShakeAnimation()
      setVers('')
      return
    }

    const coincidences = Array.from({ length: selectedChapter.verses }, (_, i) => i + 1).filter(
      (v) => v.toString().startsWith(e.target.value)
    )

    if (coincidences.length === 1) {
      setVers(coincidences[0].toString())
      onChaneVerseSearch(selectedBook.book_id, cap, coincidences[0].toString())
      inputVersRef.current?.blur()
    } else {
      setVers(e.target.value)
    }
  }

  const handleBookKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Backspace') {
      e.stopPropagation()
      setBook('')
    } else if (e.code === 'Enter') {
      const match = bibleSchema.find((b) => b.book.toLowerCase().startsWith(book.toLowerCase()))
      if (match) {
        setBook(match.book)
        setCap('')
        setVers('')
        inputCapRef.current?.focus()
      }
    }
  }

  const handleCapKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Backspace') {
      e.stopPropagation()
      setCap('')
      inputBookRef.current?.focus()
    } else if (e.code === 'Enter') {
      const selectedBook = bibleSchema.find((b) => b.book === book)
      const capNumber = parseInt(cap)
      if (
        selectedBook &&
        !isNaN(capNumber) &&
        selectedBook.chapter.some((c) => c.chapter === capNumber)
      ) {
        onChaneVerseSearch(selectedBook.book_id, capNumber.toString(), '')
        inputVersRef.current?.focus()
      }
    } else if (e.key < '0' || e.key > '9') {
      e.preventDefault()
    }
  }

  const handleVersKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Backspace') {
      e.stopPropagation()
      setVers('')
    } else if (e.code === 'Enter') {
      const selectedBook = bibleSchema.find((b) => b.book === book)
      const selectedChapter = selectedBook?.chapter.find((c) => c.chapter === parseInt(cap))
      const versNumber = parseInt(vers)

      if (
        selectedBook &&
        selectedChapter &&
        !isNaN(versNumber) &&
        versNumber >= 1 &&
        versNumber <= selectedChapter.verses
      ) {
        onChaneVerseSearch(selectedBook.book_id, cap, versNumber.toString())
        inputVersRef.current?.blur()
      }
    } else if (e.key < '0' || e.key > '9') {
      e.preventDefault()
    }
  }

  const createFocusHandler = (ref: React.RefObject<HTMLInputElement | null>) => () => {
    setIsFocused(true)
    ref.current?.select()
  }

  return (
    <div
      ref={inputContainerRef}
      className={cn(
        'flex items-centers',
        'dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border',
        'bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow]',
        'outline-none md:text-sm',
        {
          'border-ring ring-ring/50 ring-[3px]': isFocused
        }
      )}
    >
      <input
        ref={inputBookRef}
        type="text"
        placeholder="Libro"
        className="flex-1 max-w-3/5 bg-transparent outline-none"
        onFocus={createFocusHandler(inputBookRef)}
        onBlur={() => setIsFocused(false)}
        onChange={handleBookChange}
        value={book}
        onKeyDown={handleBookKeyDown}
      />
      <input
        ref={inputCapRef}
        type="text"
        placeholder="Cap."
        className="w-full bg-transparent outline-none"
        onFocus={createFocusHandler(inputCapRef)}
        onBlur={() => setIsFocused(false)}
        onChange={handleCapChange}
        value={cap}
        onKeyDown={handleCapKeyDown}
      />
      <input
        ref={inputVersRef}
        type="text"
        placeholder="Vers."
        className="w-full bg-transparent outline-none"
        onFocus={createFocusHandler(inputVersRef)}
        onBlur={() => setIsFocused(false)}
        onChange={handleVersChange}
        value={vers}
        onKeyDown={handleVersKeyDown}
      />
    </div>
  )
}
