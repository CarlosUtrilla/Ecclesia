import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { BibleSchemaDTO } from '@ecclesia/api/src/controllers/bible/bible.dto'
import { useEffect, useRef } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { CalendarPlus, Radio } from 'lucide-react'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useDraggable } from '@dnd-kit/core'
import {
  buildBibleAccessData,
  resolveBibleBookAccessId,
  serializeBibleVerseRange
} from './accessData'
import {
  splitLongBibleVerse,
  resolveBibleChunkMaxLength,
  isBibleLiveSplitMode
} from '@/lib/splitLongBibleVerse'

const BIBLE_LIVE_CHUNK_MODE_KEY = 'BIBLE_LIVE_CHUNK_MODE'

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
    queryKey: ['completeChapter', book, chapter, version],
    queryFn: async () => await window.api.bible.getCompleteChapter({ version, book, chapter }),
    staleTime: Infinity
  })

  // Obtener configuración de chunk mode para calcular splits
  const { data: chunkSettings } = useQuery({
    queryKey: ['settings', BIBLE_LIVE_CHUNK_MODE_KEY],
    queryFn: () => window.api.setttings.getSettings([BIBLE_LIVE_CHUNK_MODE_KEY as never]),
    staleTime: Infinity
  })

  const chunkMode = chunkSettings?.find((s) => s.key === BIBLE_LIVE_CHUNK_MODE_KEY)?.value
  const maxChunkLength = isBibleLiveSplitMode(chunkMode)
    ? resolveBibleChunkMaxLength(chunkMode)
    : 180

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

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <div className="p-2 bg-muted/50 font-semibold">{bookData?.book}</div>
      <div
        ref={containerRef}
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1"
      >
        {completeChapter.map((v, index) => {
          // Calcular si el versículo se debe dividir en chunks
          const chunks = splitLongBibleVerse(v.text, maxChunkLength)
          const hasMultipleChunks = chunks.length > 1

          // Si tiene múltiples chunks, mostrar cada uno
          if (hasMultipleChunks) {
            return chunks.map((chunkText, chunkIndex) => (
              <VerseItem
                key={`${v.verse}-chunk-${chunkIndex}`}
                verse={v}
                displayText={chunkText}
                index={index}
                chapter={chapter}
                version={version}
                selectedVerses={verse}
                selectedChunkKey={selectedChunkKey}
                bookAccessId={bookAccessId}
                onItemClick={handleItemClick}
                onAddToSchedule={handleAddToSchedule}
                onShowOnLive={handleShowOnLive}
                verseRefs={verseRefs}
                isChunk={true}
                chunkIndex={chunkIndex}
                totalChunks={chunks.length}
              />
            ))
          }

          // Si no se divide, mostrar normalmente
          return (
            <VerseItem
              key={v.verse}
              verse={v}
              index={index}
              chapter={chapter}
              version={version}
              selectedVerses={verse}
              selectedChunkKey={selectedChunkKey}
              bookAccessId={bookAccessId}
              onItemClick={handleItemClick}
              onAddToSchedule={handleAddToSchedule}
              onShowOnLive={handleShowOnLive}
              verseRefs={verseRefs}
            />
          )
        })}
      </div>
    </div>
  )
}

// Componente individual para cada versículo con dnd-kit
function VerseItem({
  verse: v,
  displayText,
  index,
  chapter,
  version,
  selectedVerses,
  selectedChunkKey,
  bookAccessId,
  onItemClick,
  onAddToSchedule,
  onShowOnLive,
  verseRefs,
  isChunk = false,
  chunkIndex = 0
}: {
  verse: any
  displayText?: string
  index: number
  chapter: number
  version: string
  selectedVerses: number[]
  selectedChunkKey: string | null
  bookAccessId: number | null
  onItemClick: (
    item: { verseNumber: number; index: number; chunkIndex?: number; isChunk?: boolean },
    e: React.MouseEvent
  ) => void
  onAddToSchedule: (verseNumber: number) => void
  onShowOnLive: (verseNumber: number, startChunkIndex?: number) => void
  verseRefs: React.MutableRefObject<Map<number, HTMLDivElement>>
  isChunk?: boolean
  chunkIndex?: number
  totalChunks?: number
}) {
  const verseRange = serializeBibleVerseRange(selectedVerses)
  const accessData =
    bookAccessId === null
      ? ''
      : buildBibleAccessData({
          bookId: bookAccessId,
          chapter,
          verseRange: verseRange || String(v.verse),
          version
        })

  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `verse-${v.verse}-${chapter}-${bookAccessId ?? 'unknown'}-${chunkIndex}`,
    data: {
      type: 'BIBLE',
      accessData
    }
  })

  // Usar el texto del chunk si existe, sino el texto original del verso
  const textToDisplay = displayText ?? v.text

  // Determinar si este chunk específico está seleccionado
  const chunkKey = `${v.verse}-${chunkIndex}`
  const isVerseSelected = selectedVerses.includes(v.verse)
  const isChunkSelected = selectedChunkKey === chunkKey

  // El chunk está destacado si:
  // - Es el chunk específicamente seleccionado, O
  // - El verso está seleccionado pero no hay chunk específico seleccionado
  const isHighlighted = isChunkSelected || (isVerseSelected && !selectedChunkKey)

  // Handler de doble click que pasa el chunkIndex
  const handleDoubleClick = () => {
    onShowOnLive(v.verse, isChunk ? chunkIndex : undefined)
  }

  // Handler de click que incluye información del chunk
  const handleClick = (e: React.MouseEvent) => {
    onItemClick({ verseNumber: v.verse, index, chunkIndex, isChunk }, e)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={(el) => {
            setNodeRef(el)
            // Solo guardar la ref del primer chunk de cada verso
            if (el && chunkIndex === 0) verseRefs.current.set(v.verse, el)
          }}
          className={cn(
            'flex border-b py-0.5 items-baseline hover:bg-muted/40 cursor-pointer transition-colors',
            {
              // Destacar fuerte si es el chunk específicamente seleccionado
              'bg-secondary/30 hover:bg-secondary/20 ring-1 ring-secondary/50': isChunkSelected,
              // Destacar suave si el verso está seleccionado pero no hay chunk específico
              'bg-secondary/20 hover:bg-secondary/10': isHighlighted && !isChunkSelected,
              'opacity-50 bg-muted': isDragging
            }
          )}
          role="button"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick(e as any)
            }
          }}
          {...listeners}
        >
          <div className="font-semibold text-muted-foreground w-7 text-center text-sm select-none">
            {v.verse}
          </div>
          <div className="flex-1 pr-1.5 text-sm select-none">{textToDisplay}</div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAddToSchedule(v.verse)}>
          <CalendarPlus />
          Añadir al cronograma
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDoubleClick}>
          <Radio className="text-green-600" />
          Presentar en vivo
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
