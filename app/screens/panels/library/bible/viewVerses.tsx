import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { BibleSchemaDTO } from 'database/controllers/bible/bible.dto'
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

type Props = {
  bookData?: BibleSchemaDTO
  version: string
  book: number
  chapter: number
  verse: number[]
  setSelectedVerse: (verses: number[]) => void
}

export default function ViewVerses({
  bookData,
  version,
  book,
  chapter,
  verse,
  setSelectedVerse
}: Props) {
  const internalSelectionRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorIndexRef = useRef<number | null>(null)
  const lastClickedIndexRef = useRef<number | null>(null)
  const verseRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  const { data: completeChapter = [] } = useQuery({
    queryKey: ['completeChapter', book, chapter, version],
    queryFn: async () => await window.api.bible.getCompleteChapter(version, book, chapter),
    staleTime: Infinity
  })

  const handleNavigation = (
    direction: 'up' | 'down' | 'left' | 'right',
    extendSelection?: boolean
  ) => {
    if (!completeChapter.length || verse.length === 0) return

    const currentIndex = completeChapter.findIndex((v) => v.verse === verse[verse.length - 1])
    if (currentIndex === -1) return

    let newIndex = currentIndex

    // Marcar que la selección viene del componente interno
    internalSelectionRef.current = true

    if (direction === 'down') {
      newIndex = Math.min(currentIndex + 1, completeChapter.length - 1)
    } else if (direction === 'up') {
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
    onItemClick: (item: { verseNumber: number; index: number }, event: React.MouseEvent) => {
      const { verseNumber, index } = item
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
          // No actualizar ancla en shift+click, mantener el punto de origen
        } else {
          // Fallback: si aún no hay ancla, hacer selección normal
          setSelectedVerse([verseNumber])
          anchorIndexRef.current = index
        }
      } else if (isMultiSelect) {
        // Ctrl/Cmd + click: toggle individual
        if (verse.includes(verseNumber)) {
          setSelectedVerse(verse.filter((v) => v !== verseNumber))
        } else {
          setSelectedVerse([...verse, verseNumber].sort((a, b) => a - b))
        }
        // Actualizar ancla al último elemento seleccionado
        anchorIndexRef.current = index
      } else {
        // Click normal: selección única
        setSelectedVerse([verseNumber])
        // Actualizar ancla al nuevo elemento seleccionado
        anchorIndexRef.current = index
      }

      lastClickedIndexRef.current = index
    }
  })

  useEffect(() => {
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
  }, [verse, completeChapter])

  const handleAddToSchedule = (verseNumber: number) => {
    if (verse.includes(verseNumber)) {
      const verseRange =
        verse.length === 1 ? verse[0] : `${Math.min(...verse)}-${Math.max(...verse)}`
      addItemToSchedule({
        type: 'BIBLE',
        accessData: `${bookData?.id},${chapter},${verseRange},${version}`
      })
    } else {
      addItemToSchedule({
        type: 'BIBLE',
        accessData: `${bookData?.id},${chapter},${verseNumber},${version}`
      })
    }
  }

  const handleShowOnLive = (verseNumber: number) => {
    if (verse.includes(verseNumber)) {
      const verseRange =
        verse.length === 1 ? verse[0] : `${Math.min(...verse)}-${Math.max(...verse)}`
      showItemOnLiveScreen({
        type: 'BIBLE',
        accessData: `${bookData?.id},${chapter},${verseRange},${version}`,
        id: '-1',
        order: -1,
        scheduleId: -1,
        updatedAt: new Date()
      })
    } else {
      showItemOnLiveScreen({
        type: 'BIBLE',
        accessData: `${bookData?.id},${chapter},${verseNumber},${version}`,
        id: '-1',
        order: -1,
        scheduleId: -1,
        updatedAt: new Date()
      })
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <div className="p-2 bg-muted/50 font-semibold">{bookData?.book}</div>
      <div
        ref={containerRef}
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1"
      >
        {completeChapter.map((v, index) => (
          <VerseItem
            key={v.verse}
            verse={v}
            index={index}
            bookData={bookData}
            chapter={chapter}
            version={version}
            selectedVerses={verse}
            onItemClick={handleItemClick}
            onAddToSchedule={handleAddToSchedule}
            onShowOnLive={handleShowOnLive}
            verseRefs={verseRefs}
          />
        ))}
      </div>
    </div>
  )
}

// Componente individual para cada versículo con dnd-kit
function VerseItem({
  verse: v,
  index,
  bookData,
  chapter,
  version,
  selectedVerses,
  onItemClick,
  onAddToSchedule,
  onShowOnLive,
  verseRefs
}: {
  verse: any
  index: number
  bookData?: BibleSchemaDTO
  chapter: number
  version: string
  selectedVerses: number[]
  onItemClick: (item: { verseNumber: number; index: number }, e: React.MouseEvent) => void
  onAddToSchedule: (verseNumber: number) => void
  onShowOnLive: (verseNumber: number) => void
  verseRefs: React.MutableRefObject<Map<number, HTMLDivElement>>
}) {
  const verseRange = selectedVerses.length === 1 ? selectedVerses[0] : `${Math.min(...selectedVerses)}-${Math.max(...selectedVerses)}`
  
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `verse-${v.verse}-${chapter}-${bookData?.id}`,
    data: {
      type: 'BIBLE',
      accessData: `${bookData?.id},${chapter},${verseRange},${version}`
    }
  })

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={(el) => {
            setNodeRef(el)
            if (el) verseRefs.current.set(v.verse, el)
          }}
          className={cn(
            'flex border-b py-0.5 items-baseline hover:bg-muted/40 cursor-pointer',
            {
              'bg-secondary/20 hover:bg-secondary/10': selectedVerses.includes(v.verse),
              'opacity-50 bg-muted': isDragging
            }
          )}
          role="button"
          onClick={(e) => onItemClick({ verseNumber: v.verse, index }, e)}
          onDoubleClick={() => onShowOnLive(v.verse)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onItemClick({ verseNumber: v.verse, index }, e as any)
            }
          }}
          {...listeners}
        >
          <div className="font-semibold text-muted-foreground w-7 text-center text-sm select-none">
            {v.verse}
          </div>
          <div className="flex-1 pr-1.5 text-sm select-none">{v.text}</div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAddToSchedule(v.verse)}>
          <CalendarPlus />
          Añadir al cronograma
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onShowOnLive(v.verse)}>
          <Radio className="text-green-600" />
          Presentar en vivo
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
