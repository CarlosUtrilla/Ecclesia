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
import { PropsWithChildren, useState, useCallback } from 'react'
import { useSchedule } from '..'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import LibraryItemPreview from './LibraryItemPreview'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import type { ScheduleItem } from '@prisma/client'
import { ScheduleItemComponent } from '@/screens/panels/schedule/scheduleContent/scheduleItem'

// Helper: Detecta si es un drag externo (biblioteca o group template)
const isExternalDrag = (data: any) => data?.type && data?.accessData !== undefined && !data?.item
// Helper: Valida si el drop está en área del schedule
const isValidScheduleDrop = (overId: string) =>
  overId.includes('schedule-drop-area') || overId.includes('insert-position')

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form, reorderInMainSchedule, addItemToSchedule } = useSchedule()
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const [dragSourceType, setDragSourceType] = useState<'library' | 'schedule' | null>(null)
  const formData = form.watch()

  const handleOnDragStart = useCallback(
    (event: DragStartEvent) => {
      const current = event.active.data.current
      // Items externos (biblioteca o group template)
      if (current && isExternalDrag(current)) {
        setDraggingItem(current as ScheduleItem)
        setDragSourceType('library')
        return
      }
      // Elementos internos del schedule
      if (current?.type === 'item' && current.item) {
        setDraggingItem(current.item as ScheduleItem)
        setDragSourceType('schedule')
        return
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

      // Drop sobre una carpeta de la biblioteca de medios
      if (overId.startsWith('folder-drop-')) {
        const overData = over.data.current
        const targetFolder = overData?.currentFolder
          ? `${overData.currentFolder}/${overData.folderName}`
          : overData?.folderName
        if (activeData && isExternalDrag(activeData) && activeData.type === 'MEDIA') {
          document.dispatchEvent(
            new CustomEvent('dnd:media-to-folder', {
              detail: { mediaId: activeData.accessData, targetFolder }
            })
          )
        } else if (activeData?.isFolder && activeData?.item) {
          document.dispatchEvent(
            new CustomEvent('dnd:folder-to-folder', {
              detail: { folderName: activeData.item, currentFolder: activeData.currentFolder, targetFolder }
            })
          )
        }
        handleCancel()
        return
      }

      // Elementos externos (biblioteca)
      if (activeData && isExternalDrag(activeData)) {
        if (!isValidScheduleDrop(overId)) {
          handleCancel()
          return
        }
        // Insertion zone con posición específica
        if (over.data.current?.type === 'insertion-zone') {
          const insertionPosition = over.data.current.position
          addItemToSchedule({
            type: activeData.type,
            accessData: activeData.accessData,
            insertPosition: insertionPosition
          })
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
      // Reordenamiento en lista principal
      const activeId = active.id.toString()
      const activeType = activeData?.type
      const overType = over.data.current?.type
      if (activeType === 'item' && overType === 'item') {
        reorderInMainSchedule(activeId, over.id.toString())
        handleCancel()
        return
      }
      handleCancel()
    },
    [addItemToSchedule, reorderInMainSchedule, handleCancel]
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
          <div className="scale-105 opacity-90 shadow-2xl">
            {dragSourceType === 'library' ? (
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
