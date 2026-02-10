import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { ScheduleItem } from '@prisma/client'
import { PropsWithChildren, useState } from 'react'
import { AddItemToSchedule } from '../types'
import { useSchedule } from '..'
import { generateUniqueId } from '@/lib/utils'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import ScheduleGruopItem from '@/screens/panels/schedule/components/scheduleGroups/scheduleGruopItem'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import ScheduleItemComponent from '@/screens/panels/schedule/scheduleContent/scheduleItem'

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form, reorderItems, moveItemToGroup, reorderInMainSchedule } = useSchedule()
  const [isDragginGroup, setIsDragginGroup] = useState(false)
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const formData = form.watch()

  const handleOnDragStart = (event: DragStartEvent) => {
    const current = event.active.data.current as AddItemToSchedule
    const activeId = event.active.id.toString()

    // Caso 1: Item nuevo desde fuera del schedule
    if (current?.type !== undefined && !current?.item) {
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
      return
    }

    // Caso 2: Item existente del schedule siendo reordenado
    if (current?.type === 'item' && current?.item) {
      setDraggingItem(current.item as ScheduleItem)
      return
    }

    // Caso 3: Grupo existente siendo reordenado
    if (current?.type === 'group' && current?.group) {
      setIsDragginGroup(true)
      setDraggingItem(current.group as any) // Se usará como template para overlay
      return
    }

    // Fallback: buscar en los items del schedule actual
    const existingItem = formData.items.find((item) => item.id === activeId)
    if (existingItem) {
      setDraggingItem(existingItem)
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleCancel = () => {
    setDraggingItem(null)
    setIsDragginGroup(false)
  }

  const handleEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      handleCancel()
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // Si es un group template nuevo siendo arrastrado
    if (active.data.current?.type === 'schedule-group') {
      handleCancel()
      return
    }

    // Prioridad 1: Si se arrastra sobre una zona de drop de grupo específica
    if (over.data.current?.type === 'group-drop-zone') {
      const targetGroupId = over.data.current?.group?.id
      if (targetGroupId) {
        moveItemToGroup(activeId, targetGroupId)
      }
      handleCancel()
      return
    }

    // Prioridad 2: Reordenamiento en la lista principal (items sin grupo + grupos)
    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    // Si ambos elementos están en la lista principal, reordenar
    if (
      (activeType === 'item' || activeType === 'group') &&
      (overType === 'item' || overType === 'group')
    ) {
      reorderInMainSchedule(activeId, overId)
      handleCancel()
      return
    }

    // Fallback: Si NO hay datos específicos, usar fallback
    if (!over.data.current?.type) {
      reorderInMainSchedule(activeId, overId)
    }

    // Manejar drops en área principal desde biblioteca
    if (overId === 'schedule-drop-area') {
      // Los items desde biblioteca se manejan en useDndMonitor del componente
      return
    }

    handleCancel()
  }
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleOnDragStart}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      {children}
      <DragOverlay>
        {draggingItem && (
          <div className="rotate-1 scale-105 opacity-90 shadow-2xl">
            {isDragginGroup ? (
              <ScheduleGruopItem template={draggingItem as ScheduleGroupTemplateDTO} />
            ) : (
              <ScheduleItemComponent item={draggingItem as ScheduleItem} />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
