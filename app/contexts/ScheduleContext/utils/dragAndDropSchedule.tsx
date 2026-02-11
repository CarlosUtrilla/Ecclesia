import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection
} from '@dnd-kit/core'
import { ScheduleItem, ScheduleItemType } from '@prisma/client'
import { PropsWithChildren, useState } from 'react'
import { useSchedule } from '..'
import { generateUniqueId } from '@/lib/utils'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import ScheduleGruopItem from '@/screens/panels/schedule/components/scheduleGroups/scheduleGruopItem'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import ScheduleItemComponent from '@/screens/panels/schedule/scheduleContent/scheduleItem'

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form, moveItemToGroup, reorderInMainSchedule } = useSchedule()
  const [isDragginGroup, setIsDragginGroup] = useState(false)
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const formData = form.watch()

  const handleOnDragStart = (event: DragStartEvent) => {
    const current = event.active.data.current
    const activeId = event.active.id.toString()

    console.log('🟦 DragAndDropSchedule - handleOnDragStart:', {
      activeId,
      currentType: current?.type,
      currentAccessData: current?.accessData
    })

    // Caso especial: Group templates (no tienen accessData)
    if (current?.type === 'schedule-group' && current.template) {
      console.log('🟦 Setting dragging GROUP template')
      setIsDragginGroup(true)
      setDraggingItem(current.template as ScheduleGroupTemplateDTO)
      return
    }

    // Caso 1: Items desde biblioteca (tienen accessData)
    if (current?.type && typeof current.type === 'string' && current.accessData !== undefined) {
      // convertimos el dato en item y lo seteamos como dragging item
      const item: ScheduleItem = {
        id: generateUniqueId(),
        type: current.type as ScheduleItemType,
        accessData: String(current.accessData),
        order: (formData?.items.length || 0) + 1,
        scheduleGroupId: null,
        scheduleId: -1
      }
      console.log('🟦 Creating LIBRARY item:', {
        type: current.type,
        accessData: current.accessData
      })
      setDraggingItem(item)
      return
    }

    // Caso 2: Elementos del schedule siendo reordenado (con data específica)
    if (current && typeof current === 'object' && 'type' in current) {
      if (current.type === 'item' && 'item' in current) {
        console.log('🟦 Setting dragging SCHEDULE item:', current.item)
        setDraggingItem(current.item as ScheduleItem)
        return
      }

      if (current.type === 'group' && 'group' in current) {
        console.log('🟦 Setting dragging SCHEDULE group')
        setIsDragginGroup(true)
        setDraggingItem(current.group as any)
        return
      }
    }

    // Fallback: buscar en los items del schedule actual
    const existingItem = formData.items.find((item) => item.id === activeId)
    if (existingItem) {
      console.log('🟦 Setting dragging EXISTING item from schedule:', existingItem)
      setDraggingItem(existingItem)
    } else {
      console.log('🟦 No matching item found for activeId:', activeId)
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

  // Collision detection personalizada para priorizar zonas de inserción
  const customCollisionDetection = (args: any) => {
    // Si estamos arrastrando un elemento externo (desde biblioteca)
    const isExternalDrag =
      args.active.data.current?.accessData !== undefined && !args.active.data.current?.item

    if (isExternalDrag) {
      // Para elementos externos, priorizar zonas de inserción
      const insertionZoneCollisions = Array.from(args.droppableContainers.values())
        .filter((container) => container.id.toString().startsWith('insert-position-'))
        .map((container) => {
          const collisions = rectIntersection({
            ...args,
            droppableContainers: new Map([[container.id, container]])
          })
          return collisions?.length > 0 ? collisions[0] : null
        })
        .filter(Boolean)

      if (insertionZoneCollisions.length > 0) {
        return insertionZoneCollisions
      }
    }

    // Para elementos internos o fallback, usar detección estándar
    return closestCenter(args)
  }

  const handleEnd = (event: DragEndEvent) => {
    const { active, over } = event

    console.log('🟩 DragAndDropSchedule - handleEnd:', {
      activeId: active.id,
      overId: over?.id
    })

    if (!over || active.id === over.id) {
      console.log('🟩 No over or same element - canceling')
      handleCancel()
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    // Verificar si el elemento "over" está realmente dentro del área del schedule
    const overElement = document.getElementById(overId)
    const scheduleContainer = document.querySelector('[data-schedule-container="true"]')

    // Si no encontramos el contenedor del schedule o el elemento over no está dentro, ignorar
    if (!scheduleContainer || !overElement) {
      console.log('🟩 No schedule container or over element - canceling')
      handleCancel()
      return
    }

    const isWithinSchedule = scheduleContainer.contains(overElement)
    if (!isWithinSchedule) {
      console.log('🟩 Drop outside schedule area - canceling')
      handleCancel()
      return
    }

    // Si es un elemento externo (de biblioteca), NO procesarlo aquí
    // Lo maneja el useDndMonitor en scheduleContent/index.tsx
    if (active.data.current?.accessData !== undefined && !active.data.current?.item) {
      console.log('🟩 External element (library) - letting useDndMonitor handle it')
      handleCancel()
      return
    }

    // Si es un group template nuevo siendo arrastrado
    if (active.data.current?.type === 'schedule-group') {
      console.log('🟩 Schedule group template - canceling')
      handleCancel()
      return
    }

    console.log('🟩 Processing internal schedule element')

    // Prioridad 1: Si se arrastra sobre una zona de drop de grupo específica
    if (over.data.current?.type === 'group-drop-zone') {
      const targetGroupId = over.data.current?.group?.id
      console.log('🟩 Moving to specific group:', targetGroupId)
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

    // Fallback solo para elementos internos en área del schedule
    if (!over.data.current?.type && active.data.current?.item && overId === 'schedule-drop-area') {
      reorderInMainSchedule(activeId, overId)
    }

    handleCancel()
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
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
