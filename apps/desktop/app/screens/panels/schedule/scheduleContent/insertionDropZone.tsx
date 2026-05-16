import { useDroppable, useDndContext } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import useScheduleGroupTemplates from '@/hooks/useScheduleGroupTemplates'

type Props = {
  position: number
  isFirst?: boolean
  isLast?: boolean
  groupId?: string
}

export default function InsertionDropZone({
  position,
  isFirst = false,
  isLast = false,
  groupId
}: Props) {
  const { active } = useDndContext()
  const [groupColor, setGroupColor] = useState<string | undefined>(undefined)
  const { scheduleGroupTemplates } = useScheduleGroupTemplates()

  useEffect(() => {
    if (groupId) {
      const group = scheduleGroupTemplates.find((g) => g.id === parseInt(groupId))
      if (group) {
        setGroupColor(group.color)
      } else {
        setGroupColor(undefined)
      }
    }
  }, [groupId, scheduleGroupTemplates])

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
      className={cn(
        'w-full flex items-center justify-center transition-all duration-200 h-2.5 opacity-0',
        {
          'bg-primary/20 border-2 border-dashed border-primary rounded h-8 mb-0.5 opacity-100':
            isOver
        }
      )}
      style={{
        background: groupColor ? groupColor + '33' : undefined
      }}
    >
      <span className="text-primary text-sm font-medium">Soltar para insertar aquí</span>
    </div>
  )
}
