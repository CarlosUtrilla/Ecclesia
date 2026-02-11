import { ScheduleItemData } from '@/contexts/ScheduleContext/types'
import { AnimatePresence, motion } from 'framer-motion'
import { ScheduleItem } from '@prisma/client'
import ScheduleItemComponent from './scheduleItem'
import { getContrastTextColor, cn } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `schedule-group-${group.group?.id}`,
    data: { type: 'group-drop-zone', group: group.group! }
  })

  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `schedule-group-${group.group!.id}`,
    data: { type: 'group', group: group.group! }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setSortableNodeRef}
      style={{
        background: group.group!.color,
        ...style
      }}
      className={cn('p-2 rounded-md transition-all duration-200', {
        'cursor-grab': !isDragging,
        'cursor-grabbing': isDragging,
        'shadow-lg ring-2 ring-primary/30 scale-[1.02]': isDragging,
        'hover:shadow-md hover:scale-[1.01]': !isDragging,
        'ring-1 ring-blue-300': isDragging
      })}
      {...attributes}
      {...listeners}
    >
      <p
        className="font-semibold mb-2 text-sm pointer-events-none select-none"
        style={{
          color: getContrastTextColor(group.group!.color)
        }}
      >
        {group.group!.name}
      </p>
      <div
        ref={setDroppableNodeRef}
        className={cn(
          'relative bg-background rounded-md border border-muted/30 space-y-2 p-2 transition-all duration-200 min-h-[3rem]',
          {
            'border-2 border-dashed border-primary/50 bg-primary/5 shadow-inner':
              isOver && !isDragging,
            'border-muted/20': !isOver
          }
        )}
      >
        {group.items.length === 0 && (
          <div
            className={cn(
              'text-xs text-muted-foreground italic p-2 py-3 transition-all duration-200 text-center',
              {
                'text-primary/70 font-medium': isOver && !isDragging
              }
            )}
          >
            {isOver && !isDragging
              ? 'Suelta aquí para agregar al grupo'
              : 'No hay elementos en este grupo, arrastra y suelta elementos aquí.'}
          </div>
        )}
        <SortableContext
          items={group.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {group.items.map((item) => (
            <ScheduleItemComponent
              key={item.id}
              item={item}
              setSelectedItem={setSelectedItem}
              selectedItem={selectedItem}
            />
          ))}
        </SortableContext>
        <AnimatePresence>
          {isOver && !isDragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-primary/10 rounded-md pointer-events-none border-2 border-dashed border-primary/40"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
