import { Button } from '@/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Save, CalendarSearch, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScheduleGroup, ScheduleItem } from '@prisma/client'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import GroupTemplateManager from '../components/scheduleGroups/GroupTemplateManagerDialog'
import { DragEndEvent, useDndMonitor, useDroppable } from '@dnd-kit/core'
import EmptyShcedule from './emptyShcedule'
import PreviewSchedule from './previewSchedule'
import { AddItemToSchedule } from '@/contexts/ScheduleContext/types'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import ScheduleGroupItem from './scheduleGroupItem'
import { ScheduleGroupTemplateDTO } from 'database/controllers/schedule/schedule.dto'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import InsertionDropZone from './insertionDropZone'

type ScheduleContentProps = {
  onBack: () => void
}

function ScheduleContentComponent({ onBack }: ScheduleContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { isOver, setNodeRef } = useDroppable({
    id: 'schedule-drop-area'
  })
  const {
    currentSchedule,
    form,
    getScheduleItemContentScreen,
    selectedTheme,
    addItemToSchedule,
    addGroupToSchedule,
    saveScheduleChanges,
    itemsSortableIndex
  } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [itemContent, setItemContent] = useState<PresentationViewItems[] | null>(null)

  useEffect(() => {
    if (selectedItem) {
      const fetchContent = async () => {
        const content = await getScheduleItemContentScreen(selectedItem)
        setItemContent(content.content)
      }
      fetchContent()
    } else {
      setItemContent(null)
    }
  }, [selectedItem])

  useKeyboardShortcuts(containerRef, {
    onDelete: () => {
      if (selectedItem) {
        /* const index = currentSchedule?.items.findIndex((i) => i.order === selectedItem.order)
        if (index !== undefined && index >= 0) {
          deleteItemFromSchedule(index)
          setSelectedItem(null)
        } */
      }
    },
    onClickOutside: () => {
      setSelectedItem(null)
    }
  })

  useDndMonitor({
    onDragEnd: (e: DragEndEvent) => {
      try {
        const data = e.active.data.current

        console.log('🟨 useDndMonitor - onDragEnd:', {
          activeId: e.active.id,
          dataType: data?.type,
          dataAccessData: data?.accessData,
          overId: e.over?.id,
          overType: e.over?.data?.current?.type
        })

        if (!data || !e.over) {
          console.log('🟨 No data or no over element - returning')
          return
        }

        // Check if it's dropped on an insertion zone
        if (e.over.data.current?.type === 'insertion-zone') {
          const insertionData = e.over.data.current
          const position = insertionData.position
          console.log('🟨 Inserting at specific position:', position)

          addItemToSchedule({
            ...(data as AddItemToSchedule),
            insertPosition: position
          })
          return
        }

        // Check if it's a group template
        if (data.type === 'schedule-group') {
          console.log('🟨 Adding group template to schedule:', data.template)
          addGroupToSchedule(data.template as ScheduleGroupTemplateDTO)
          return
        }

        if (e.over.id.toString().includes('schedule-group-')) {
          // Handle dropping into a schedule group
          console.log('🟨 Adding item to specific group:', data)
          const group = e.over.data.current as ScheduleGroup
          addItemToSchedule(data as AddItemToSchedule, group.id)
          return
        }

        // Handle regular items
        console.log('🟨 Adding regular item to schedule:', data)
        addItemToSchedule(data as AddItemToSchedule)
      } catch (error) {
        console.error('Error al procesar drop:', error)
      }
    }
  })

  if (!currentSchedule) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">No hay ningún schedule seleccionado.</p>
      </div>
    )
  }

  const {
    formState: { isDirty }
  } = form
  const pendingSave = isDirty

  return (
    <>
      <div
        className={cn('h-full flex flex-col', {
          'h-7/12': itemContent && itemContent.length && selectedItem
        })}
        ref={containerRef}
      >
        {/* Header con info del schedule */}
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
          <div>
            <h2 className="font-medium">{form.getValues('title') || 'Sin título'}</h2>
          </div>
          <GroupTemplateManager>
            <Button size="sm" className="ml-auto">
              Grupos
            </Button>
          </GroupTemplateManager>

          <Button size="sm" disabled={!pendingSave} onClick={saveScheduleChanges}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
          <Button size="sm" onClick={onBack}>
            <CalendarSearch className="h-4 w-4" />
            Cronogramas
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3" ref={setNodeRef}>
          {currentSchedule.length === 0 ? (
            <EmptyShcedule isOver={isOver} />
          ) : (
            <div className="min-h-full transition-colors relative">
              <div className="flex flex-col">
                <SortableContext items={itemsSortableIndex} strategy={verticalListSortingStrategy}>
                  {/* Zona de inserción al principio */}
                  <div className="h-4 mb-1">
                    <InsertionDropZone position={0} isFirst={true} />
                  </div>

                  {currentSchedule.map((group, index) => (
                    <div key={group.group?.id || `item-${group.items[0]?.id}`}>
                      <ScheduleGroupItem
                        group={group}
                        setSelectedItem={setSelectedItem}
                        selectedItem={selectedItem}
                      />
                      {/* Zona de inserción después de cada elemento */}
                      <div className="h-0.5 mt-1">
                        <InsertionDropZone
                          position={index + 1}
                          isLast={index === currentSchedule.length - 1}
                        />
                      </div>
                    </div>
                  ))}
                </SortableContext>
              </div>
              <AnimatePresence>
                {isOver && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="absolute animate-in fade-in duration-300 -inset-2 flex items-center justify-center pointer-events-none bg-primary/10 rounded-md border-2 border-dashed border-primary"
                  >
                    <div className="mt-4 p-8 border-2 border-dashed border-primary rounded-lg bg-primary/5 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-primary font-medium">
                        Soltar para agregar al final
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
      {itemContent && itemContent.length && selectedItem ? (
        <PreviewSchedule
          itemContent={itemContent}
          selectedItem={selectedItem}
          selectedTheme={selectedTheme}
          onLivePresentation={(index) => {
            showItemOnLiveScreen(selectedItem, index)
            setSelectedItem(null)
          }}
        />
      ) : null}
    </>
  )
}

export default function ScheduleContent({ onBack }: ScheduleContentProps) {
  return <ScheduleContentComponent onBack={onBack} />
}
