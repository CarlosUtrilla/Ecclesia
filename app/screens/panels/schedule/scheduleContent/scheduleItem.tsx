import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import { ScheduleItem } from '@prisma/client'
import { useEffect, useState } from 'react'

type Props = {
  setSelectedItem?: (item: ScheduleItem | null) => void
  isSelected?: boolean
  item: ScheduleItem
}
export default function ScheduleItemComponent({ isSelected, setSelectedItem, item }: Props) {
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
  return (
    <div
      className={cn(
        'p-3 py-1.5 bg-background border cursor-pointer rounded-md hover:bg-muted/50 transition-colors',
        {
          'border-secondary bg-secondary/10': isSelected
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
  )
}
