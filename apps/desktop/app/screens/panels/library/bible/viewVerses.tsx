import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { BibleSchemaDTO } from '@ecclesia/api/src/controllers/bible/bible.dto'
import { useEffect, useMemo, useRef } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ContextMenuItem } from '@/ui/context-menu'
import { CalendarPlus, Radio } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import {
  buildBibleAccessData,
  resolveBibleBookAccessId,
  serializeBibleVerseRange
} from './accessData'
import { resolveBibleChunkMaxLength, isBibleLiveSplitMode } from '@/lib/splitLongBibleVerse'
import BibleChapterVerseList, { BibleVerseRow } from '@/ui/bible/bibleChapterVerseList'
import { Api } from '@ecclesia/queries'
import { useDefaultBiblePresentationSettings } from '@/hooks/useDefaultBiblePresentationSettings'

type Props = {
  bookData?: BibleSchemaDTO
  version: string
  book: number
  chapter: number
  verse: number[]
  setSelectedVerse: (verses: number[]) => void
  selectedChunkKey: string | null
  setSelectedChunkKey: (key: string | null) => void
}

export default function ViewVerses({
  bookData,
  version,
  book,
  chapter,
  verse,
  setSelectedVerse,
  selectedChunkKey,
  setSelectedChunkKey
}: Props) {
  const internalSelectionRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorIndexRef = useRef<number | null>(null)
  const lastClickedIndexRef = useRef<number | null>(null)
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const scopeKeyRef = useRef('')

  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const bookAccessId = resolveBibleBookAccessId(bookData)

  const { data: completeChapter = [] } = useQuery({
    ...Api.query.bible.getCompleteChapter({ body: { version, book, chapter } }),
    staleTime: Infinity
  })

  // Obtener configuración de chunk mode desde BiblePresentationSettings
  const { defaultBiblePresentationSettings } = useDefaultBiblePresentationSettings()

  const maxChunkLength = useMemo(() => {
    const mode = defaultBiblePresentationSettings?.chunkMaxLength
    const chunkMode = isBibleLiveSplitMode(mode) ? mode : 'auto'
    return resolveBibleChunkMaxLength(chunkMode)
  }, [defaultBiblePresentationSettings?.chunkMaxLength])

  const handleNavigation = (
    direction: 'up' | 'down' | 'left' | 'right' | 'PageUp' | 'PageDown',
    extendSelection?: boolean
  ) => {
    if (!completeChapter.length || verse.length === 0) return

    const currentIndex = completeChapter.findIndex((v) => v.verse === verse[verse.length - 1])
    if (currentIndex === -1) return

    let newIndex = currentIndex

    // Marcar que la selección viene del componente interno
    internalSelectionRef.current = true

    if (direction === 'down' || direction === 'right' || direction === 'PageDown') {
      newIndex = Math.min(currentIndex + 1, completeChapter.length - 1)
    } else if (direction === 'up' || direction === 'left' || direction === 'PageUp') {
      newIndex = Math.max(currentIndex - 1, 0)
    } else {
      return // Solo soportamos up/down para versículos
    }

    if (extendSelection) {
      // Shift + flechas: extender selección desde el ancla
      // Solo establecer ancla si no existe (primera vez)
      if (anchorIndexRef.current === null) {
        anchorIndexRef.current = currentIndex
      }
      const start = Math.min(anchorIndexRef.current, newIndex)
      const end = Math.max(anchorIndexRef.current, newIndex)
      const rangeVerses = completeChapter.slice(start, end + 1).map((v) => v.verse)
      setSelectedVerse(rangeVerses)
      // NO actualizar ancla durante selección extendida
    } else {
      // Flechas solas: mover selección y actualizar/resetear ancla
      setSelectedVerse([completeChapter[newIndex].verse])
      anchorIndexRef.current = newIndex
    }

    lastClickedIndexRef.current = newIndex
  }

  const { handleItemClick } = useKeyboardShortcuts(containerRef, {
    onNavigate: handleNavigation,
    onEnter: () => {
      // Enviar a live el verso seleccionado
      if (verse.length === 0) return

      // Si hay un chunk específico seleccionado, enviar ese chunk
      if (selectedChunkKey) {
        const [verseStr, chunkIndexStr] = selectedChunkKey.split('-')
        const verseNumber = parseInt(verseStr)
        const chunkIndex = parseInt(chunkIndexStr)

        if (!isNaN(verseNumber) && !isNaN(chunkIndex)) {
          handleShowOnLive(verseNumber, chunkIndex)
          return
        }
      }

      // Si no hay chunk específico, enviar el primer verso seleccionado
      handleShowOnLive(verse[0])
    },
    onItemClick: (
      item: { verseNumber: number; index: number; chunkIndex?: number; isChunk?: boolean },
      event: React.MouseEvent
    ) => {
      const { verseNumber, index, chunkIndex = 0, isChunk = false } = item
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const isMultiSelect = isMac ? event.metaKey : event.ctrlKey
      const isRangeSelect = event.shiftKey

      // Marcar que la selección viene del componente interno
      internalSelectionRef.current = true

      if (isRangeSelect) {
        // Shift + click: seleccionar rango desde el ancla
        // Si no hay ancla, inicializar con el primer verso seleccionado actualmente
        if (anchorIndexRef.current === null && verse.length > 0) {
          const currentVerseIndex = completeChapter.findIndex((v) => v.verse === verse[0])
          if (currentVerseIndex !== -1) {
            anchorIndexRef.current = currentVerseIndex
          }
        }

        if (anchorIndexRef.current !== null) {
          const start = Math.min(anchorIndexRef.current, index)
          const end = Math.max(anchorIndexRef.current, index)
          const rangeVerses = completeChapter.slice(start, end + 1).map((v) => v.verse)
          setSelectedVerse(rangeVerses)
          // Limpiar selección de chunk específico al seleccionar rango
          setSelectedChunkKey(null)
          // No actualizar ancla en shift+click, mantener el punto de origen
        } else {
          // Fallback: si aún no hay ancla, hacer selección normal
          setSelectedVerse([verseNumber])
          anchorIndexRef.current = index
          // Si es chunk, establecer selección de chunk
          if (isChunk) {
            setSelectedChunkKey(`${verseNumber}-${chunkIndex}`)
          } else {
            setSelectedChunkKey(null)
          }
        }
      } else if (isMultiSelect) {
        // Ctrl/Cmd + click: toggle individual
        if (verse.includes(verseNumber)) {
          setSelectedVerse(verse.filter((v) => v !== verseNumber))
        } else {
          setSelectedVerse([...verse, verseNumber].sort((a, b) => a - b))
        }
        // Limpiar selección de chunk específico al hacer multi-selección
        setSelectedChunkKey(null)
        // Actualizar ancla al último elemento seleccionado
        anchorIndexRef.current = index
      } else {
        // Click normal: selección única
        setSelectedVerse([verseNumber])
        // Si es chunk, establecer selección de chunk específico
        if (isChunk) {
          setSelectedChunkKey(`${verseNumber}-${chunkIndex}`)
        } else {
          setSelectedChunkKey(null)
        }
        // Actualizar ancla al nuevo elemento seleccionado
        anchorIndexRef.current = index
      }

      lastClickedIndexRef.current = index
    }
  })

  useEffect(() => {
    const currentScopeKey = `${version}:${book}:${chapter}`
    const scopeChanged = scopeKeyRef.current !== currentScopeKey
    if (scopeChanged) {
      scopeKeyRef.current = currentScopeKey
      // Limpiar selección de chunk cuando cambia el scope
      setSelectedChunkKey(null)
    }

    if (scopeChanged || !internalSelectionRef.current) {
      if (verse.length > 0 && completeChapter.length > 0) {
        const selectedVerseIndex = completeChapter.findIndex((v) => v.verse === verse[0])
        if (selectedVerseIndex !== -1) {
          anchorIndexRef.current = selectedVerseIndex
          lastClickedIndexRef.current = selectedVerseIndex
        } else {
          anchorIndexRef.current = null
          lastClickedIndexRef.current = null
        }
      } else {
        anchorIndexRef.current = null
        lastClickedIndexRef.current = null
      }
    }

    // Scroll automático al verso seleccionado solo si viene del panel superior
    if (
      verse.length > 0 &&
      containerRef.current &&
      !internalSelectionRef.current &&
      completeChapter.length > 0
    ) {
      const firstSelectedVerse = verse[0]
      const verseElement = verseRefs.current.get(firstSelectedVerse)

      if (verseElement) {
        // Pequeño delay para asegurar que el DOM está actualizado
        setTimeout(() => {
          verseElement.scrollIntoView({
            behavior: 'instant',
            block: 'center'
          })
        }, 50)
      }
    }

    // Reset del flag después de procesar el cambio
    internalSelectionRef.current = false
  }, [verse, completeChapter, version, book, chapter, setSelectedChunkKey])

  const handleAddToSchedule = (verseNumber: number) => {
    if (bookAccessId === null) return

    const verseRange = verse.includes(verseNumber)
      ? serializeBibleVerseRange(verse)
      : String(verseNumber)

    addItemToSchedule({
      type: 'BIBLE',
      accessData: buildBibleAccessData({
        bookId: bookAccessId,
        chapter,
        verseRange,
        version
      })
    })
  }

  const handleShowOnLive = (verseNumber: number, startChunkIndex?: number) => {
    if (bookAccessId === null) return

    const verseRange = verse.includes(verseNumber)
      ? serializeBibleVerseRange(verse)
      : String(verseNumber)

    // Si hay selectedChunkKey y coincide con el verso, usar ese chunk
    let chunkIndexToUse = startChunkIndex ?? 0
    if (selectedChunkKey && selectedChunkKey.startsWith(`${verseNumber}-`)) {
      const chunkIndex = parseInt(selectedChunkKey.split('-')[1])
      if (!isNaN(chunkIndex)) {
        chunkIndexToUse = chunkIndex
      }
    }

    showItemOnLiveScreen(
      {
        type: 'BIBLE',
        accessData: buildBibleAccessData({
          bookId: bookAccessId,
          chapter,
          verseRange,
          version
        }),
        id: '-1',
        order: -1,
        scheduleId: -1,
        updatedAt: new Date(),
        deletedAt: null
      },
      chunkIndexToUse
    )
  }

  const verseRangeSerialized = serializeBibleVerseRange(verse)

  const buildRowAccessData = (row: BibleVerseRow) =>
    bookAccessId === null
      ? ''
      : buildBibleAccessData({
          bookId: bookAccessId,
          chapter,
          verseRange: verseRangeSerialized || String(row.verse),
          version
        })

  const clickItemFromRow = (row: BibleVerseRow) => ({
    verseNumber: row.verse,
    index: row.index,
    chunkIndex: row.chunkIndex,
    isChunk: row.isChunk
  })

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <div className="p-2 bg-muted/50 font-semibold">{bookData?.book}</div>
      <div
        ref={containerRef}
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1"
      >
        <BibleChapterVerseList
          completeChapter={completeChapter}
          maxChunkLength={maxChunkLength}
          rowClassName={(row) => {
            const isChunkSelected = selectedChunkKey === `${row.verse}-${row.chunkIndex}`
            const isVerseSelected = verse.includes(row.verse)
            const isHighlighted = isChunkSelected || (isVerseSelected && !selectedChunkKey)
            return cn({
              'bg-secondary/30 hover:bg-secondary/20 ring-1 ring-secondary/50': isChunkSelected,
              'bg-secondary/20 hover:bg-secondary/10': isHighlighted && !isChunkSelected
            })
          }}
          onRowClick={(row, event) => handleItemClick(clickItemFromRow(row), event)}
          onRowDoubleClick={(row) =>
            handleShowOnLive(row.verse, row.isChunk ? row.chunkIndex : undefined)
          }
          onRowKeyDown={(row, event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleItemClick(clickItemFromRow(row), event as unknown as React.MouseEvent)
            }
          }}
          registerRowRef={(verseNumber, element) => {
            if (element) verseRefs.current.set(verseNumber, element)
            else verseRefs.current.delete(verseNumber)
          }}
          getDragData={(row) => ({
            id: `verse-${row.verse}-${chapter}-${bookAccessId ?? 'unknown'}-${row.chunkIndex}`,
            data: {
              type: 'BIBLE',
              accessData: buildRowAccessData(row),
              label: `${bookData?.book || ''} ${chapter}:${verseRangeSerialized || row.verse}`.trim()
            }
          })}
          renderContextMenu={(row) => (
            <>
              <ContextMenuItem onClick={() => handleAddToSchedule(row.verse)}>
                <CalendarPlus />
                Añadir al cronograma
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  handleShowOnLive(row.verse, row.isChunk ? row.chunkIndex : undefined)
                }
              >
                <Radio className="text-green-600" />
                Presentar en vivo
              </ContextMenuItem>
            </>
          )}
        />
      </div>
    </div>
  )
}
