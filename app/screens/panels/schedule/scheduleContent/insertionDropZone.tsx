import { useDroppable, useDndContext } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

type Props = {
  position: number
  isFirst?: boolean
  isLast?: boolean
}

export default function InsertionDropZone({ position, isFirst = false, isLast = false }: Props) {
  const { active } = useDndContext()

  // Detectar si se está arrastrando un elemento externo (de biblioteca)
  const isExternalDrag =
    active?.data.current?.accessData !== undefined && !active?.data.current?.item

  const { setNodeRef, isOver } = useDroppable({
    id: `insert-position-${position}`,
    data: {
      type: 'insertion-zone',
      position,
      isFirst,
      isLast
    },
    disabled: !isExternalDrag // Solo habilitar para elementos externos
  })

  return (
    <div
      ref={setNodeRef}
      id={`insert-position-${position}`}
      className={cn('w-full flex items-center justify-center transition-all duration-200 h-2', {
        'bg-primary/20 border-2 border-dashed border-primary rounded h-6 mb-0.5 ': isOver
      })}
    ></div>
  )
}
