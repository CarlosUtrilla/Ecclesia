import { Fragment, ReactNode, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { splitLongBibleVerse } from '@/lib/splitLongBibleVerse'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/ui/context-menu'

/**
 * Componente compartido para renderizar los versículos de un capítulo,
 * partiendo los versículos largos en fragmentos con la MISMA lógica que usa
 * el resto de la app (`splitLongBibleVerse` + configuración de la DB).
 *
 * Lo usan tanto la biblioteca (`library/bible/viewVerses`) como el diálogo de
 * inserción del editor de presentaciones (`presentationEditor/bibleTextPicker`)
 * para que ambos troceen y se vean igual; cada consumidor aporta su propia
 * selección/acciones (rango vs cronograma/live/dnd) por props.
 */

export type BibleVerseRow = {
  verse: number
  /** Índice del versículo dentro del capítulo (no del fragmento). */
  index: number
  chunkIndex: number
  /** true cuando el versículo se dividió en más de un fragmento. */
  isChunk: boolean
  totalChunks: number
  text: string
  /** El número de versículo solo se muestra en el primer fragmento. */
  showNumber: boolean
}

type ChapterVerse = { verse: number; text?: string | null }

export type BibleDragData = { id: string; data: Record<string, unknown> }

type Props = {
  completeChapter: ChapterVerse[]
  maxChunkLength: number
  /** Clases extra por fila (típicamente el resaltado de selección). */
  rowClassName?: (row: BibleVerseRow) => string | undefined
  onRowClick?: (row: BibleVerseRow, event: React.MouseEvent) => void
  onRowDoubleClick?: (row: BibleVerseRow, event: React.MouseEvent) => void
  onRowKeyDown?: (row: BibleVerseRow, event: React.KeyboardEvent) => void
  /** Se invoca con el primer fragmento de cada versículo (para auto-scroll). */
  registerRowRef?: (verse: number, element: HTMLDivElement | null) => void
  /** Si devuelve datos, la fila es arrastrable (dnd-kit). */
  getDragData?: (row: BibleVerseRow) => BibleDragData | null
  /** Contenido del menú contextual por fila (hijos de `ContextMenuContent`). */
  renderContextMenu?: (row: BibleVerseRow) => ReactNode
}

/** Deriva las filas (una por fragmento) de un capítulo. Fuente única del split. */
export function buildChapterVerseRows(
  completeChapter: ChapterVerse[],
  maxChunkLength: number
): BibleVerseRow[] {
  const rows: BibleVerseRow[] = []

  completeChapter.forEach((verse, index) => {
    const rawText = verse.text ?? ''
    const chunks = rawText ? splitLongBibleVerse(rawText, maxChunkLength) : []

    if (chunks.length > 1) {
      chunks.forEach((chunkText, chunkIndex) => {
        rows.push({
          verse: verse.verse,
          index,
          chunkIndex,
          isChunk: true,
          totalChunks: chunks.length,
          text: chunkText,
          showNumber: chunkIndex === 0
        })
      })
      return
    }

    // Sin dividir: se muestra el texto original crudo del versículo.
    rows.push({
      verse: verse.verse,
      index,
      chunkIndex: 0,
      isChunk: false,
      totalChunks: 1,
      text: rawText,
      showNumber: true
    })
  })

  return rows
}

const ROW_BASE_CLASS =
  'flex border-b py-0.5 items-baseline hover:bg-muted/40 cursor-pointer transition-colors'

type RowContentProps = {
  row: BibleVerseRow
  className: string
  onClick?: (event: React.MouseEvent) => void
  onDoubleClick?: (event: React.MouseEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  setRef: (element: HTMLDivElement | null) => void
  dragListeners?: React.HTMLAttributes<HTMLDivElement>
}

function RowContent({
  row,
  className,
  onClick,
  onDoubleClick,
  onKeyDown,
  setRef,
  dragListeners
}: RowContentProps) {
  return (
    <div
      ref={setRef}
      className={className}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      {...dragListeners}
    >
      <div className="font-semibold text-muted-foreground w-7 text-center text-sm select-none">
        {row.showNumber ? row.verse : ''}
      </div>
      <div className="flex-1 pr-1.5 text-sm select-none">{row.text}</div>
    </div>
  )
}

type StaticRowProps = {
  row: BibleVerseRow
  className: string
  onClick?: (event: React.MouseEvent) => void
  onDoubleClick?: (event: React.MouseEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  registerRowRef?: (verse: number, element: HTMLDivElement | null) => void
}

function StaticRow({ row, className, onClick, onDoubleClick, onKeyDown, registerRowRef }: StaticRowProps) {
  return (
    <RowContent
      row={row}
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      setRef={(element) => {
        if (row.chunkIndex === 0) registerRowRef?.(row.verse, element)
      }}
    />
  )
}

type DraggableRowProps = StaticRowProps & { dragData: BibleDragData }

function DraggableRow({
  row,
  className,
  onClick,
  onDoubleClick,
  onKeyDown,
  registerRowRef,
  dragData
}: DraggableRowProps) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: dragData.id,
    data: dragData.data
  })

  return (
    <RowContent
      row={row}
      className={cn(className, { 'opacity-50 bg-muted': isDragging })}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      setRef={(element) => {
        setNodeRef(element)
        if (row.chunkIndex === 0) registerRowRef?.(row.verse, element)
      }}
      dragListeners={listeners as React.HTMLAttributes<HTMLDivElement>}
    />
  )
}

export default function BibleChapterVerseList({
  completeChapter,
  maxChunkLength,
  rowClassName,
  onRowClick,
  onRowDoubleClick,
  onRowKeyDown,
  registerRowRef,
  getDragData,
  renderContextMenu
}: Props) {
  const rows = useMemo(
    () => buildChapterVerseRows(completeChapter, maxChunkLength),
    [completeChapter, maxChunkLength]
  )

  return (
    <>
      {rows.map((row) => {
        const className = cn(ROW_BASE_CLASS, rowClassName?.(row))
        const dragData = getDragData?.(row) ?? null

        const rowNode = dragData ? (
          <DraggableRow
            row={row}
            className={className}
            dragData={dragData}
            onClick={onRowClick ? (event) => onRowClick(row, event) : undefined}
            onDoubleClick={onRowDoubleClick ? (event) => onRowDoubleClick(row, event) : undefined}
            onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(row, event) : undefined}
            registerRowRef={registerRowRef}
          />
        ) : (
          <StaticRow
            row={row}
            className={className}
            onClick={onRowClick ? (event) => onRowClick(row, event) : undefined}
            onDoubleClick={onRowDoubleClick ? (event) => onRowDoubleClick(row, event) : undefined}
            onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(row, event) : undefined}
            registerRowRef={registerRowRef}
          />
        )

        const contextMenu = renderContextMenu?.(row)
        const key = `${row.verse}-${row.chunkIndex}`

        if (contextMenu) {
          return (
            <ContextMenu key={key}>
              <ContextMenuTrigger>{rowNode}</ContextMenuTrigger>
              <ContextMenuContent>{contextMenu}</ContextMenuContent>
            </ContextMenu>
          )
        }

        return <Fragment key={key}>{rowNode}</Fragment>
      })}
    </>
  )
}
