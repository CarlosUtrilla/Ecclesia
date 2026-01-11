import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

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

  const { data: bibleSchema = [] } = useQuery({
    queryKey: ['bibleSchema'],
    queryFn: async () => await window.api.bible.getBibleSchema(),
    staleTime: Infinity
  })
  const [isFocused, setIsFocused] = useState(false)

  const [book, setBook] = useState(
    initialBook ? bibleSchema.find((b) => b.book_id === initialBook)?.book || '' : ''
  )
  const [cap, setCap] = useState(initialCap)
  const [vers, setVers] = useState(initialVers)

  const handleBookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const coincidences = bibleSchema.filter((b) =>
      b.book.toLowerCase().startsWith(e.target.value.toLowerCase())
    )
    if (coincidences.length > 0) {
      if (coincidences.length === 1) {
        setBook(coincidences[0].book)
        setCap('') //resetear capitulo y versiculo
        setVers('')
        inputCapRef.current?.focus()
      } else {
        setBook(e.target.value)
      }
    } else {
      inputContainerRef.current!.classList.add('animate-shake')
      setTimeout(() => {
        inputContainerRef.current!.classList.remove('animate-shake')
      }, 500)
      setBook('')
    }
  }

  const handleCapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedBook = bibleSchema.find((b) => b.book === book)

    if (selectedBook) {
      //buscar si el numero ingesado corresponde con algun capitulo del libro seleccionado
      const capNumber = parseInt(e.target.value)
      if (!isNaN(capNumber) && selectedBook.chapter.some((c) => c.chapter === capNumber)) {
        //Comprobar si es unico, caso el usuario ingresa 1 pero hay mas de un capitulo que inicia con 1 como 10, 11, 12, etc
        const coincidences = selectedBook.chapter.filter((c) =>
          c.chapter.toString().startsWith(e.target.value)
        )
        if (coincidences.length === 1) {
          setCap(coincidences[0].chapter.toString())
          setVers('') //resetear versiculo
          inputVersRef.current?.focus()
        } else {
          setCap(e.target.value)
        }
      } else {
        inputContainerRef.current!.classList.add('animate-shake')
        setTimeout(() => {
          inputContainerRef.current!.classList.remove('animate-shake')
        }, 500)
        setCap('')
      }
    }
  }

  const handleVersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Similar al capitulo, pero buscando en los versiculos
    const selectedBook = bibleSchema.find((b) => b.book === book)
    if (selectedBook) {
      const capNumber = parseInt(cap)
      const selectedChapter = selectedBook.chapter.find((c) => c.chapter === capNumber)
      if (selectedChapter) {
        const versNumber = parseInt(e.target.value)
        if (!isNaN(versNumber) && versNumber >= 1 && versNumber <= selectedChapter.verses) {
          //Comprobar si es unico, caso el usuario ingresa 1 pero hay mas de un capitulo que inicia con 1 como 10, 11, 12, etc
          const coincidences = Array.from(
            { length: selectedChapter.verses },
            (_, i) => i + 1
          ).filter((v) => v.toString().startsWith(e.target.value))
          if (coincidences.length === 1) {
            setVers(coincidences[0].toString())
            //Llamar al callback de cambio
            onChaneVerseSearch(
              selectedBook.book_id,
              selectedChapter.chapter.toString(),
              coincidences[0].toString()
            )
            inputVersRef.current?.blur()
          } else {
            setVers(e.target.value)
          }
        } else {
          inputContainerRef.current!.classList.add('animate-shake')
          setTimeout(() => {
            inputContainerRef.current!.classList.remove('animate-shake')
          }, 500)
          setVers('')
        }
      }
    }
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
        onFocus={() => {
          setIsFocused(true)
          inputBookRef.current?.select()
        }}
        onBlur={() => setIsFocused(false)}
        onChange={handleBookChange}
        value={book}
        onKeyDown={(e) => {
          console.log(e)
          if (e.code === 'Backspace') {
            e.stopPropagation()
            setBook('')
          } else if (e.code === 'Enter') {
            // aplicar el texto ingresado como libro solo si encuentra una coincidencia y luego ir al capitulo
            const coincidences = bibleSchema.filter((b) =>
              b.book.toLowerCase().startsWith(book.toLowerCase())
            )
            if (coincidences.length === 1) {
              setBook(coincidences[0].book)
              setCap('') //resetear capitulo y versiculo
              setVers('')
              inputCapRef.current?.focus()
            }
          }
        }}
      />
      <input
        ref={inputCapRef}
        type="text"
        placeholder="Cap."
        className="w-full bg-transparent outline-none"
        onFocus={() => {
          setIsFocused(true)
          inputCapRef.current?.select()
        }}
        onBlur={() => setIsFocused(false)}
        onChange={handleCapChange}
        value={cap}
        onKeyDown={(e) => {
          if (e.code === 'Backspace') {
            e.stopPropagation()
            setCap('')
            inputBookRef.current?.focus()
          }
          if (e.code === 'Enter') {
            // aplicar el texto ingresado como capitulo y luego ir al versiculo
            const selectedBook = bibleSchema.find((b) => b.book === book)
            if (selectedBook) {
              const capNumber = parseInt(cap)
              if (!isNaN(capNumber) && selectedBook.chapter.some((c) => c.chapter === capNumber)) {
                onChaneVerseSearch(
                  selectedBook.book_id,
                  capNumber.toString(),
                  '' // versiculo vacio
                )
                inputVersRef.current?.focus()
              }
            }
          } else {
            //Solo permitir numeros
            if (e.key < '0' || e.key > '9') {
              e.preventDefault()
            }
          }
        }}
      />
      <input
        ref={inputVersRef}
        type="text"
        placeholder="Vers."
        className="w-full bg-transparent outline-none"
        onFocus={() => {
          setIsFocused(true)
          inputVersRef.current?.select()
        }}
        onBlur={() => setIsFocused(false)}
        onChange={handleVersChange}
        value={vers}
        onKeyDown={(e) => {
          if (e.code === 'Backspace') {
            e.stopPropagation()
            setVers('')
          }
          if (e.code === 'Enter') {
            // aplicar el texto ingresado como versiculo
            const selectedBook = bibleSchema.find((b) => b.book === book)
            if (selectedBook) {
              const capNumber = parseInt(cap)
              const selectedChapter = selectedBook.chapter.find((c) => c.chapter === capNumber)
              if (selectedChapter) {
                const versNumber = parseInt(vers)
                if (!isNaN(versNumber) && versNumber >= 1 && versNumber <= selectedChapter.verses) {
                  onChaneVerseSearch(
                    selectedBook.book_id,
                    selectedChapter.chapter.toString(),
                    versNumber.toString()
                  )
                  inputVersRef.current?.blur()
                }
              }
            }
          } else {
            //Solo permitir numeros
            if (e.key < '0' || e.key > '9') {
              e.preventDefault()
            }
          }
        }}
      />
    </div>
  )
}
