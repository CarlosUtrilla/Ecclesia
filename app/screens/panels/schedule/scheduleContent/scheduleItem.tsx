import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { ScheduleItem } from '@prisma/client'
import { Radio, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
  item: ScheduleItem
}
export default function ScheduleItemComponent({ selectedItem, setSelectedItem, item }: Props) {
  const { getScheduleItemIcon, getScheduleItemLabel } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const [label, setLabel] = useState('')
  useEffect(() => {
    const fetchLabel = async () => {
      const lbl = await getScheduleItemLabel(item)
      setLabel(lbl as string)
    }
    fetchLabel()
  }, [])

  console.log(selectedItem?.id, item)
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'p-3 py-1.5 bg-background border cursor-pointer rounded-md hover:bg-muted/50 transition-colors',
            {
              'border-secondary bg-secondary/10': selectedItem?.order === item.order
            }
          )}
          onClick={(e) => {
            setSelectedItem?.(item)
            e.preventDefault()
          }}
          onDoubleClick={() => showItemOnLiveScreen(item, 0)}
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
  )
}
