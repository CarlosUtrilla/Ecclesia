import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

type Props = {
  position: number
  isFirst?: boolean
  isLast?: boolean
}

export default function InsertionDropZone({ position, isFirst = false, isLast = false }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `insert-position-${position}`,
    data: {
      type: 'insertion-zone',
      position,
      isFirst,
      isLast
    }
  })

  return (
    <div
      ref={setNodeRef}
      className={cn('w-full h-full flex items-center justify-center transition-all duration-200', {
        'bg-primary/20 border-2 border-dashed border-primary rounded': isOver,
        'hover:bg-primary/5': !isOver
      })}
    ></div>
  )
}
