import { ScheduleItemData } from '@/contexts/ScheduleContext/types'
import { AnimatePresence, motion } from 'framer-motion'
import { ScheduleItem } from '@prisma/client'
import ScheduleItemComponent from './scheduleItem'
import { getContrastTextColor } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'

type Props = {
  group: ScheduleItemData
  setSelectedItem?: (item: ScheduleItem | null) => void
  selectedItem?: ScheduleItem | null
}
export default function ScheduleGroupItem({ group, setSelectedItem, selectedItem }: Props) {
  if (group.group === null) {
    return (
      <ScheduleItemComponent
        item={group.items[0]}
        setSelectedItem={setSelectedItem}
        selectedItem={selectedItem}
      />
    )
  }

  return <GroupRender group={group} setSelectedItem={setSelectedItem} selectedItem={selectedItem} />
}

const GroupRender = ({ group, setSelectedItem, selectedItem }: Props) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `schedule-group-${group.group?.id}`,
    data: group.group!
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        background: group.group!.color
      }}
      className="p-2 rounded-md"
    >
      <p
        className="font-semibold mb-2 text-sm"
        style={{
          color: getContrastTextColor(group.group!.color)
        }}
      >
        {group.group!.name}
      </p>
      <div className="relative bg-background rounded-md border-muted/30 space-y-2">
        {group.items.length === 0 && (
          <p className="text-xs text-muted-foreground italic p-3 py-2">
            No hay elementos en este grupo, arrastra y suelta elementos aquí.
          </p>
        )}
        {group.items.map((item) => (
          <ScheduleItemComponent
            key={item.id}
            item={item}
            setSelectedItem={setSelectedItem}
            selectedItem={selectedItem}
          />
        ))}
        <AnimatePresence>
          {isOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute border-2 border-dashed border-primary inset-0 bg-primary/10 rounded-md pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
