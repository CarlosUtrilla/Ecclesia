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
import type { ScheduleItem } from '@prisma/client'
import { Radio, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
  item: ScheduleItem
  groupId?: string
  insertPosition?: number
  isLast?: boolean
}

export function ScheduleItemComponent({
  setSelectedItem,
  selectedItem,
  item,
  groupId,
  insertPosition,
  isLast
}: Props) {
  // Drop zone para inserción
  const { active } = useDndContext()
  // Detectar si se está arrastrando un elemento externo (de biblioteca)
  const isExternalDrag =
    active?.data.current?.accessData !== undefined && !active?.data.current?.item
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `insert-position-${insertPosition}`,
    data: {
      type: 'insertion-zone',
      position: insertPosition,
      isLast
    },
    disabled: !isExternalDrag
  })
  const { getScheduleItemIcon, getScheduleItemLabel, deleteItemFromSchedule, currentSchedule } =
    useSchedule()

  const { showItemOnLiveScreen } = useLive()
  const [label, setLabel] = useState('')
  const [groupTemplate, setGroupTemplate] = useState<any>(null)
  const [groupColor, setGroupColor] = useState<string | undefined>(undefined)
  const { scheduleGroupTemplates } = useScheduleGroupTemplates()
  useEffect(() => {
    const fetchLabel = async () => {
      const lbl = await getScheduleItemLabel(item)
      setLabel(lbl as string)
    }
    fetchLabel()
  }, [])

  useEffect(() => {
    if (item.type === 'GROUP' && item.accessData) {
      window.api.schedule.getGroupTemplateById?.(parseInt(item.accessData)).then(setGroupTemplate)
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
    id: item.id,
    data: { type: 'item', item: item }
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        <div
          className={cn(
            'w-full flex items-center justify-center transition-all duration-200 h-2.5 ',
            {
              'bg-primary/20 border-2 border-dashed border-primary rounded h-8 my-1':
                isOver && isExternalDrag
            }
          )}
        >
          <span
            className={cn('text-primary text-sm font-medium opacity-0', {
              'opacity-100': isOver && isExternalDrag
            })}
          >
            Soltar para insertar aquí
          </span>
        </div>
      </div>
    )
  }
  const belongsToGroup = groupId !== undefined
  return (
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
      <div
        className={cn(
          'w-full flex items-center justify-center transition-all duration-200 h-2.5 opacity-0',
          {
            'bg-primary/20 border-2 border-dashed border-primary rounded h-8 my-1 opacity-100':
              isOver && isExternalDrag
          }
        )}
      >
        <span className="text-primary text-sm font-medium">Soltar para insertar aquí</span>
      </div>
    </div>
  )
}
