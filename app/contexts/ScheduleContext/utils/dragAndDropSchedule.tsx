import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  pointerWithin
} from '@dnd-kit/core'
import { ScheduleItem, ScheduleItemType } from '@prisma/client'
import { PropsWithChildren, useState, useCallback } from 'react'
import { useSchedule } from '..'
import { generateUniqueId } from '@/lib/utils'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import ScheduleGruopItem from '@/screens/panels/schedule/components/scheduleGroups/scheduleGruopItem'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import ScheduleItemComponent from '@/screens/panels/schedule/scheduleContent/scheduleItem'
import LibraryItemPreview from './LibraryItemPreview'

// Helper: Detecta si es un drag externo (biblioteca)
const isExternalDrag = (data: any) => data?.accessData !== undefined && !data?.item

// Helper: Detecta si es un group template
const isGroupTemplate = (data: any) => data?.type === 'schedule-group' && data?.template

// Helper: Valida si el drop está en área del schedule
const isValidScheduleDrop = (overId: string) =>
  overId.includes('schedule-drop-area') ||
  overId.includes('insert-position') ||
  overId.includes('schedule-group-')

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form, moveItemToGroup, reorderInMainSchedule, addGroupToSchedule, addItemToSchedule } =
    useSchedule()
  const [isDragginGroup, setIsDragginGroup] = useState(false)
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const [dragSourceType, setDragSourceType] = useState<'library' | 'schedule' | null>(null)
  const formData = form.watch()

  const handleOnDragStart = useCallback(
    (event: DragStartEvent) => {
      console.log(event)
      const current = event.active.data.current
      const activeId = event.active.id.toString()

      // Group templates
      if (current && isGroupTemplate(current)) {
        setIsDragginGroup(true)
        setDraggingItem(current.template as ScheduleGroupTemplateDTO)
        setDragSourceType('schedule')
        return
      }

      // Items desde biblioteca
      if (current && isExternalDrag(current)) {
        const item: ScheduleItem = {
          id: generateUniqueId(),
          type: current.type as ScheduleItemType,
          accessData: String(current.accessData),
          order: (formData?.items.length || 0) + 1,
          scheduleGroupId: null,
          scheduleId: -1
        }
        setDraggingItem(item)
        setDragSourceType('library')
        return
      }

      // Elementos internos del schedule
      if (current?.type === 'item' && current.item) {
        setDraggingItem(current.item as ScheduleItem)
        setDragSourceType('schedule')
        return
      }

      if (current?.type === 'group' && current.group) {
        setIsDragginGroup(true)
        setDraggingItem(current.group)
        setDragSourceType('schedule')
        return
      }

      // Fallback: buscar en items actuales
      const existingItem = formData.items.find((item) => item.id === activeId)
      if (existingItem) {
        setDraggingItem(existingItem)
        setDragSourceType('schedule')
      }
    },
    [formData.items]
  )

  const sensorsInstance = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleCancel = useCallback(() => {
    setDraggingItem(null)
    setIsDragginGroup(false)
    setDragSourceType(null)
  }, [])

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) {
        handleCancel()
        return
      }

      const overId = over.id.toString()
      const activeData = active.data.current

      // Elementos externos (biblioteca)
      if (activeData && isExternalDrag(activeData)) {
        if (!isValidScheduleDrop(overId)) {
          handleCancel()
          return
        }

        // Insertion zone con posición específica
        if (over.data.current?.type === 'insertion-zone') {
          const insertionPosition = over.data.current.position
          console.log('🟦 Dropping on insertion zone:', {
            position: insertionPosition,
            isFirst: over.data.current.isFirst,
            isLast: over.data.current.isLast,
            overId,
            itemType: activeData.type
          })

          addItemToSchedule({
            type: activeData.type,
            accessData: activeData.accessData,
            insertPosition: insertionPosition
          })
          handleCancel()
          return
        }

        // Drop en grupo específico
        if (overId.includes('schedule-group-')) {
          addItemToSchedule(
            { type: activeData.type, accessData: activeData.accessData },
            over.data.current?.group?.id
          )
          handleCancel()
          return
        }

        // Drop regular al final
        addItemToSchedule({
          type: activeData.type,
          accessData: activeData.accessData
        })
        handleCancel()
        return
      }

      // Group templates
      if (activeData && isGroupTemplate(activeData)) {
        addGroupToSchedule(activeData.template as ScheduleGroupTemplateDTO)
        handleCancel()
        return
      }

      // Reordenamiento interno
      const activeId = active.id.toString()

      // Mover a grupo específico
      if (over.data.current?.type === 'group-drop-zone') {
        const targetGroupId = over.data.current?.group?.id
        if (targetGroupId) {
          moveItemToGroup(activeId, targetGroupId)
        }
        handleCancel()
        return
      }

      // Reordenamiento en lista principal
      const activeType = activeData?.type
      const overType = over.data.current?.type

      if (
        (activeType === 'item' || activeType === 'group') &&
        (overType === 'item' || overType === 'group')
      ) {
        reorderInMainSchedule(activeId, overId)
      }

      handleCancel()
    },
    [addItemToSchedule, addGroupToSchedule, moveItemToGroup, reorderInMainSchedule, handleCancel]
  )

  return (
    <DndContext
      sensors={sensorsInstance}
      collisionDetection={pointerWithin}
      onDragStart={handleOnDragStart}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      {children}
      <DragOverlay>
        {draggingItem && (
          <div className=" scale-105 opacity-90 shadow-2xl">
            {isDragginGroup ? (
              <ScheduleGruopItem template={draggingItem as ScheduleGroupTemplateDTO} />
            ) : dragSourceType === 'library' ? (
              <LibraryItemPreview item={draggingItem as ScheduleItem} />
            ) : (
              <ScheduleItemComponent item={draggingItem as ScheduleItem} />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
