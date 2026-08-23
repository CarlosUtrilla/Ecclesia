import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import useScheduleGroupTemplates from '@/hooks/useScheduleGroupTemplates'
import { cn, getContrastTextColor } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable, useDndContext } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ScheduleItem } from '@ecclesia/api'
import { Pencil, Radio, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Api } from '@ecclesia/queries'
import { Tooltip } from '@/ui/tooltip'
import PreviewSchedule from './previewSchedule'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { parseBibleAccessData } from '../../library/bible/accessData'
import { parseTimerAccessData } from '@/lib/timerAccessData'
import ChurchCountdownDialog from '@/screens/components/ChurchCountdownDialog'
import useBibleSchema from '@/hooks/useBibleSchema'
import { isExternalDragData } from '@/contexts/ScheduleContext/utils/scheduleCollision'
import { usePendingInsertion } from '@/contexts/ScheduleContext/utils/pendingInsertion'
import InsertionIndicator, {
  GROUP_INSERTION_GAP,
  INSERTION_DURATION_MS,
  INSERTION_EASING,
  INSERTION_GAP
} from './insertionIndicator'

type Props = {
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
  item: ScheduleItem
  groupId?: string
  insertPosition?: number
  isLast?: boolean
  setTooltipRef?: (ref: HTMLDivElement | null) => void
  /** Copia renderizada dentro del DragOverlay: no debe registrarse en dnd-kit. */
  isPreview?: boolean
}

export function ScheduleItemComponent({
  setSelectedItem,
  selectedItem,
  item,
  groupId,
  insertPosition,
  isLast,
  setTooltipRef,
  isPreview = false
}: Props) {
  // Drop zone para inserción
  const { active, over } = useDndContext()
  const pendingInsertion = usePendingInsertion()
  // Detectar si se está arrastrando un elemento externo (de biblioteca)
  const isExternalDrag = isExternalDragData(active?.data.current)
  // La copia del DragOverlay usa ids propios: si reutilizara los del item real
  // sobreescribiría su registro en dnd-kit y ese item dejaría de detectarse.
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: isPreview ? `preview-insert-${item.id}` : `insert-position-${insertPosition}`,
    data: {
      type: 'insertion-zone',
      position: insertPosition,
      isLast
    },
    disabled: isPreview || !isExternalDrag
  })
  const {
    getScheduleItemIcon,
    deleteItemFromSchedule,
    currentSchedule,
    getScheduleItemContentScreen,
    selectedTheme,
    songs,
    media,
    presentations
  } = useSchedule()

  const { getCompleteNameById } = useBibleSchema()
  const { showItemOnLiveScreen } = useLive()
  const [groupTemplate, setGroupTemplate] = useState<any>(null)
  const [groupColor, setGroupColor] = useState<string | undefined>(undefined)
  const { scheduleGroupTemplates } = useScheduleGroupTemplates()

  const [itemContent, setItemContent] = useState<PresentationViewItems[] | null>(null)
  const [fallbackLabel, setFallbackLabel] = useState<string | null>(null)
  const [timerEditOpen, setTimerEditOpen] = useState(false)

  // Label reactivo: se actualiza cuando cambian songs/media/presentations
  const label = useMemo(() => {
    switch (item.type) {
      case 'SONG': {
        const song = songs.find((s) => s.id === parseInt(item.accessData))
        return song?.title ?? fallbackLabel ?? '...'
      }
      case 'MEDIA': {
        const med = media.find((m) => m.id === parseInt(item.accessData))
        return med?.name ?? fallbackLabel ?? '...'
      }
      case 'PRESENTATION': {
        const p = presentations.find((p) => p.id === parseInt(item.accessData))
        return p?.title ?? fallbackLabel ?? '...'
      }
      case 'BIBLE': {
        const parsed = parseBibleAccessData(item.accessData)
        if (!parsed) return item.accessData
        return `${getCompleteNameById(parsed.bookId) || parsed.bookId} ${parsed.chapter}:${parsed.verseRange}`
      }
      case 'TIMER':
        return parseTimerAccessData(item.accessData).title || 'Cuenta atrás'
      default:
        return item.accessData
    }
  }, [item, songs, media, presentations, fallbackLabel, getCompleteNameById])

  // Fallback: fetch individual si no está en songs/media/presentations, solo al montar
  useEffect(() => {
    if (item.type === 'GROUP') return
    if (
      (item.type === 'SONG' && songs.some((s) => s.id === parseInt(item.accessData))) ||
      (item.type === 'MEDIA' && media.some((m) => m.id === parseInt(item.accessData))) ||
      (item.type === 'PRESENTATION' &&
        presentations.some((p) => p.id === parseInt(item.accessData)))
    ) {
      return
    }
    const fetchFallback = async () => {
      try {
        if (item.type === 'SONG') {
          const res = await Api.fetch.songs.getSongById({ body: { id: parseInt(item.accessData) } })
          if (res) setFallbackLabel(res.title)
        } else if (item.type === 'MEDIA') {
          const res = await Api.fetch.media.getMediaByIds({
            body: { ids: [parseInt(item.accessData)] }
          })
          if (res?.[0]) setFallbackLabel(res[0].name)
        } else if (item.type === 'PRESENTATION') {
          const res = await Api.fetch.presentations.getPresentationById({
            body: { id: parseInt(item.accessData) }
          })
          if (res) setFallbackLabel(res.title)
        }
      } catch {
        // ignorar
      }
    }
    fetchFallback()
  }, [])

  useEffect(() => {
    const fetchContent = async () => {
      const content = await getScheduleItemContentScreen(item)
      console.log('Fetched content for item', item, content)
      setItemContent(content.content)
    }
    fetchContent()
  }, [getScheduleItemContentScreen, item, songs, media, presentations])

  useEffect(() => {
    if (item.type === 'GROUP' && item.accessData) {
      Api.fetch.schedule
        .getGroupTemplateById?.({ body: { id: parseInt(item.accessData) } })
        .then(setGroupTemplate)
    }
    if (groupId) {
      const group = scheduleGroupTemplates.find((g) => g.id === parseInt(groupId))
      if (group) {
        setGroupColor(group.color)
      } else {
        setGroupColor(undefined)
      }
    }
  }, [item, groupId, scheduleGroupTemplates])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: isPreview ? `preview-${item.id}` : item.id,
    data: { type: 'item', item: item },
    disabled: isPreview,
    // Sin animación de layout: al insertarse un item, dnd-kit animaba a los siguientes
    // desde su posición anterior (FLIP), lo que se sumaba al hueco y hacía el rebote.
    animateLayoutChanges: () => false
  })
  // Los items posteriores a la zona activa se desplazan para abrir el hueco donde caerá
  // el nuevo item. Se hace con transform (no con layout) porque dnd-kit mide los
  // droppables ignorando transforms: el espacio se abre sin mover las zonas de detección.
  const hoveredInsertPosition =
    isExternalDrag && over?.data.current?.type === 'insertion-zone'
      ? (over.data.current.position as number)
      : null
  // Al soltar se conserva el hueco hasta que el item entra en la lista, para que no suba
  // y vuelva a bajar mientras react-hook-form propaga el cambio.
  const gapPosition = hoveredInsertPosition ?? pendingInsertion
  const shiftDown =
    gapPosition !== null && insertPosition !== undefined && insertPosition > gapPosition

  // El hueco mide lo que ocupará el item entrante, para que al soltar no haya salto
  const insertionGap = active?.data.current?.type === 'GROUP' ? GROUP_INSERTION_GAP : INSERTION_GAP

  const style = {
    transform:
      [CSS.Transform.toString(transform), shiftDown ? `translate3d(0, ${insertionGap}px, 0)` : null]
        .filter(Boolean)
        .join(' ') || undefined,
    // Sólo se anima mientras se arrastra: al soltar, el transform se quita en el mismo
    // commit en que el item entra en la lista, así el hueco se convierte en el item nuevo
    // en vez de cerrarse y volver a abrirse (rebote).
    transition:
      transition ??
      (isExternalDrag ? `transform ${INSERTION_DURATION_MS}ms ${INSERTION_EASING}` : undefined),
    opacity: isDragging ? 0.5 : 1
  }

  if (item.type === 'GROUP') {
    // Permitir eliminar grupo desde el menú contextual
    return (
      <div
        className="rounded-t-md"
        ref={(node) => {
          setNodeRef(node)
          setDropNodeRef(node)
        }}
        style={{
          ...style,
          background: groupTemplate?.color + 33 || '#e0e0e0'
        }}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'rounded-t-md border font-semibold text-base px-4 py-2 select-none cursor-grab',
                'animate-in fade-in zoom-in-95 duration-300',
                {
                  'cursor-grabbing': isDragging,
                  'cursor-grab': !isDragging,
                  'shadow-lg border-primary/50 bg-primary/5': isDragging
                }
              )}
              style={{
                background: groupTemplate?.color || '#e0e0e0',
                color: getContrastTextColor(groupTemplate?.color || '#e0e0e0'),
                opacity: isDragging ? 0.5 : 0.95,
                borderColor: isOver ? '#3b82f6' : undefined,
                boxShadow: isOver ? '0 0 0 2px #3b82f6' : undefined
              }}
              {...attributes}
              {...listeners}
            >
              <span>{groupTemplate?.name || 'Grupo'}</span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                const index = currentSchedule.findIndex((i) => i.id === item.id)
                if (index !== -1) {
                  deleteItemFromSchedule(index)
                  setSelectedItem?.(null)
                }
              }}
            >
              <Trash2 className="text-destructive size-4" />
              Eliminar grupo
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <InsertionIndicator visible={isOver && isExternalDrag} animated={isExternalDrag} />
      </div>
    )
  }
  // Item normal, renderizar con menú contextual
  const belongsToGroup = groupId !== undefined
  return (
    <Tooltip
      content={
        itemContent ? (
          <PreviewSchedule
            itemContent={itemContent}
            selectedItem={item}
            selectedTheme={selectedTheme}
            onLivePresentation={(index) => {
              showItemOnLiveScreen(item, index)
              setSelectedItem?.(null)
            }}
          />
        ) : null
      }
      open={selectedItem?.id === item.id && itemContent !== null}
      contentProps={{
        side: 'right',
        className: 'bg-muted [&>span>svg]:fill-muted [&>span>svg]:bg-muted text-muted-foreground',
        ref: (el) => {
          setTooltipRef?.(el)
        }
      }}
    >
      <div
        style={{
          background: belongsToGroup && groupColor && !isDragging ? groupColor + '33' : undefined,
          ...style
        }}
        className={cn({})}
        ref={(node) => {
          setNodeRef(node)
          setDropNodeRef(node)
        }}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'p-3 py-1.5 border bg-background cursor-pointer rounded-md hover:bg-muted/50 transition-all duration-200',
                // Entrada al insertarse en el cronograma (drop desde la biblioteca)
                'animate-in fade-in zoom-in-95 duration-300',
                {
                  'border-secondary bg-secondary/10': selectedItem?.order === item.order,
                  'cursor-grabbing': isDragging,
                  'cursor-grab': !isDragging,
                  'shadow-lg border-primary/50 bg-primary/5': isDragging,
                  'ml-4 mr-2': belongsToGroup && !isDragging
                }
              )}
              onClick={(e) => {
                setSelectedItem?.(item)
                e.preventDefault()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedItem?.(item)
                }
              }}
              onDoubleClick={() => showItemOnLiveScreen(item, 0)}
              {...attributes}
              {...listeners}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary">{getScheduleItemIcon(item)}</span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {(item.type === 'SONG' || item.type === 'PRESENTATION') && (
              <ContextMenuItem
                onClick={() => {
                  const id = parseInt(item.accessData)
                  if (item.type === 'SONG') {
                    window.windowAPI.openSongWindow(id)
                  } else if (item.type === 'PRESENTATION') {
                    window.windowAPI.openPresentationWindow(id)
                  }
                }}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </ContextMenuItem>
            )}
            {item.type === 'TIMER' && (
              <ContextMenuItem onClick={() => setTimerEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onClick={() => {
                showItemOnLiveScreen(item, 0)
              }}
            >
              <Radio className="h-4 w-4 text-green-600" />
              Presentar en vivo
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const index = currentSchedule.findIndex((i) => i.id === item.id)
                if (index !== -1) {
                  deleteItemFromSchedule(index)
                  setSelectedItem?.(null)
                }
              }}
            >
              <Trash2 className="text-destructive size-4" />
              Eliminar del cronograma
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {item.type === 'TIMER' ? (
          <ChurchCountdownDialog
            open={timerEditOpen}
            onOpenChange={setTimerEditOpen}
            editItem={item}
          />
        ) : null}
        <InsertionIndicator visible={isOver && isExternalDrag} animated={isExternalDrag} />
      </div>
    </Tooltip>
  )
}
