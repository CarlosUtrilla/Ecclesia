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
import { CSS } from '@dnd-kit/utilities'
import { ScheduleItem } from '@prisma/client'
import { Radio, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
  item: ScheduleItem
  groupId?: string
}

export default function ScheduleItemComponent({
  selectedItem,
  setSelectedItem,
  item,
  groupId
}: Props) {
  const { getScheduleItemIcon, getScheduleItemLabel } = useSchedule()
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
  // Vista normal para items
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', item: item }
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Vista especial para grupo visual (reordenable)
  if (item.type === 'GROUP') {
    return (
      <div
        className="rounded-t-md border font-semibold text-base px-4 py-2 select-none cursor-grab"
        style={{
          ...style,
          background: groupTemplate?.color || '#e0e0e0',
          color: getContrastTextColor(groupTemplate?.color || '#e0e0e0'),
          opacity: isDragging ? 0.5 : 0.95
        }}
        ref={setNodeRef}
        {...attributes}
        {...listeners}
      >
        {groupTemplate?.name || 'Grupo'}
      </div>
    )
  }
  const belongsToGroup = groupId !== undefined
  return (
    <div
      style={{
        background: belongsToGroup && groupColor ? groupColor + '33' : undefined,
        ...style
      }}
      className={cn({})}
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
                'ml-4 mr-2': belongsToGroup
              }
            )}
            onClick={(e) => {
              setSelectedItem?.(item)
              e.preventDefault()
            }}
            onDoubleClick={() => showItemOnLiveScreen(item, 0)}
            ref={setNodeRef}
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
          <ContextMenuItem>
            <Trash2 className="text-destructive size-4" />
            Eliminar del cronograma
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
