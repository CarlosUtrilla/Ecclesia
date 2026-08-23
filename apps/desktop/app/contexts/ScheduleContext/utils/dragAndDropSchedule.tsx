import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DropAnimation } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { PropsWithChildren, useState, useCallback, useEffect, useRef } from 'react'
import { useSchedule } from '..'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import LibraryItemPreview from './LibraryItemPreview'
import { ScheduleGroupTemplateDTO } from '@ecclesia/api/src/controllers/schedule/schedule.dto'
import type { ScheduleItem } from '@ecclesia/api'
import { ScheduleItemComponent } from '@/screens/panels/schedule/scheduleContent/scheduleItem'
import { isExternalDragData, scheduleCollisionDetection } from './scheduleCollision'
import { PendingInsertionContext } from './pendingInsertion'

// Helper: Valida si el drop está en área del schedule
const isValidScheduleDrop = (overId: string) =>
  overId.includes('schedule-drop-area') || overId.includes('insert-position')

/**
 * Los droppables del cronograma se habilitan/deshabilitan durante el drag y la lista
 * puede desplazarse, así que hay que volver a medirlos mientras se arrastra: con la
 * medición por defecto (una sola vez al iniciar) las zonas de en medio quedaban
 * desfasadas y el drop no se detectaba.
 */
const measuringConfig = {
  droppable: { strategy: MeasuringStrategy.Always, frequency: 100 }
}

/**
 * Al soltar, la animación por defecto devuelve el preview a su origen. Para los drags de
 * biblioteca eso parecía que el drop se había rechazado (el item ya está insertado en el
 * cronograma), así que el preview se desvanece donde se soltó. Para el reordenamiento
 * interno se mantiene la animación por defecto: ahí el origen ya es la posición final.
 */
const dropAnimation: DropAnimation = {
  duration: 280,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  keyframes: ({ active, transform }) => {
    const from = { transform: CSS.Transform.toString(transform.initial) }

    if (isExternalDragData(active.data.current)) {
      return [
        { ...from, opacity: 1 },
        {
          transform: CSS.Transform.toString({
            ...transform.initial,
            scaleX: 0.9,
            scaleY: 0.9
          }),
          opacity: 0
        }
      ]
    }

    return [from, { transform: CSS.Transform.toString(transform.final) }]
  }
}

export default function DragAndDropSchedule({ children }: PropsWithChildren) {
  const { form, reorderInMainSchedule, addItemToSchedule } = useSchedule()
  const [draggingItem, setDraggingItem] = useState<ScheduleItem | ScheduleGroupTemplateDTO | null>(
    null
  )
  const [dragSourceType, setDragSourceType] = useState<'library' | 'schedule' | null>(null)
  const formData = form.watch()
  // Posición insertada + cuántos items había al soltar: mientras el largo no cambie, la
  // inserción sigue pendiente y el hueco se mantiene abierto (ver `pendingInsertion.tsx`).
  const pendingInsertionRef = useRef<{ position: number; count: number } | null>(null)
  const pendingInsertion =
    pendingInsertionRef.current?.count === formData.items.length
      ? pendingInsertionRef.current.position
      : null

  // Una vez que el item entra en la lista la inserción deja de estar pendiente: si no se
  // limpiara, un largo de lista que vuelva a coincidir (p. ej. al borrar un item) abriría
  // un hueco fantasma.
  useEffect(() => {
    if (pendingInsertionRef.current?.count !== formData.items.length) {
      pendingInsertionRef.current = null
    }
  }, [formData.items.length])

  const handleOnDragStart = useCallback(
    (event: DragStartEvent) => {
      const current = event.active.data.current
      pendingInsertionRef.current = null
      // Items externos (biblioteca o group template)
      if (current && isExternalDragData(current)) {
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
        if (activeData && isExternalDragData(activeData) && activeData.type === 'MEDIA') {
          document.dispatchEvent(
            new CustomEvent('dnd:media-to-folder', {
              detail: { mediaId: activeData.accessData, targetFolder }
            })
          )
        } else if (activeData?.isFolder && activeData?.item) {
          document.dispatchEvent(
            new CustomEvent('dnd:folder-to-folder', {
              detail: {
                folderName: activeData.item,
                currentFolder: activeData.currentFolder,
                targetFolder
              }
            })
          )
        }
        handleCancel()
        return
      }

      // Elementos externos (biblioteca)
      if (activeData && isExternalDragData(activeData)) {
        if (!isValidScheduleDrop(overId)) {
          handleCancel()
          return
        }
        // Insertion zone con posición específica
        if (over.data.current?.type === 'insertion-zone') {
          const insertionPosition = over.data.current.position
          pendingInsertionRef.current = {
            position: insertionPosition,
            count: formData.items.length
          }
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
    [addItemToSchedule, reorderInMainSchedule, handleCancel, formData.items.length]
  )

  return (
    <DndContext
      sensors={sensorsInstance}
      collisionDetection={scheduleCollisionDetection}
      measuring={measuringConfig}
      onDragStart={handleOnDragStart}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      <PendingInsertionContext.Provider value={pendingInsertion}>
        {children}
      </PendingInsertionContext.Provider>
      <DragOverlay dropAnimation={dropAnimation}>
        {draggingItem && (
          <div className="scale-105 opacity-90 shadow-2xl">
            {dragSourceType === 'library' ? (
              <LibraryItemPreview item={draggingItem as ScheduleItem} />
            ) : (
              <ScheduleItemComponent item={draggingItem as ScheduleItem} isPreview />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
