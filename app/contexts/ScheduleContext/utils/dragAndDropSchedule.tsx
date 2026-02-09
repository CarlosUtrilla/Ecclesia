import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { ScheduleItem } from '@prisma/client'
import { PropsWithChildren, useState } from 'react'
import { AddItemToSchedule } from '../types'
import ScheduleItemComponent from '@/screens/panels/schedule/components/scheduleContent/scheduleItem'
import { useSchedule } from '..'
import { generateUniqueId } from '@/lib/utils'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import ScheduleGruopItem from '@/screens/panels/schedule/components/scheduleGroups/scheduleGruopItem'

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form } = useSchedule()
  const [isDragginGroup, setIsDragginGroup] = useState(false)
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const formData = form.watch()
  const handleOnDragStart = (event: DragStartEvent) => {
    //Comprobamos si el item que se esta arrastrando es uno compatible con el schedule
    const current = event.active.data.current as AddItemToSchedule
    if (current.type !== undefined) {
      if ((current.type as any) === 'schedule-group') {
        setIsDragginGroup(true)
        setDraggingItem((current as any).template as ScheduleGroupTemplateDTO)
        return
      }
      // convertimos el dato en item y lo seteamos como dragging item
      const item: ScheduleItem = {
        id: generateUniqueId(),
        type: current.type,
        accessData: String(current.accessData),
        order: (formData?.items.length || 0) + 1,
        scheduleGroupId: null,
        scheduleId: -1
      }
      setDraggingItem(item)
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      onActivation: (event) => console.log('onActivation', event), // Here!
      activationConstraint: { distance: 5 }
    })
  )

  const handleCancel = () => {
    setDraggingItem(null)
    setIsDragginGroup(false)
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleOnDragStart}
      onDragEnd={handleCancel}
      onDragCancel={handleCancel}
    >
      {children}
      <DragOverlay>
        {draggingItem ? (
          isDragginGroup ? (
            <ScheduleGruopItem template={draggingItem as ScheduleGroupTemplateDTO} />
          ) : (
            <ScheduleItemComponent item={draggingItem as ScheduleItem} />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
