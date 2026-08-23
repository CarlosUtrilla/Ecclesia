import { useDroppable, useDndContext } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import useScheduleGroupTemplates from '@/hooks/useScheduleGroupTemplates'
import { isExternalDragData } from '@/contexts/ScheduleContext/utils/scheduleCollision'
import InsertionIndicator from './insertionIndicator'

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
  const isExternalDrag = isExternalDragData(active?.data.current)

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
    <div ref={setNodeRef} id={`insert-position-${position}`}>
      <InsertionIndicator visible={isOver} animated={isExternalDrag} color={groupColor} />
    </div>
  )
}
