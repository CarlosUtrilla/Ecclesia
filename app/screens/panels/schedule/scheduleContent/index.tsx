import { Button } from '@/ui/button'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Save, CalendarSearch, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScheduleItem } from '@prisma/client'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import GroupTemplateManager from './GroupTemplateManagerDialog'
import { DragEndEvent, useDndMonitor, useDroppable } from '@dnd-kit/core'
import EmptyShcedule from './emptyShcedule'
import PreviewSchedule from './previewSchedule'
import ScheduleItemComponent from './scheduleItem'
import { AddItemToSchedule } from '@/contexts/ScheduleContext/types'

type ScheduleContentProps = {
  onBack: () => void
}

function ScheduleContentComponent({ onBack }: ScheduleContentProps) {
  const { currentSchedule, form, getScheduleItemContentScreen, selectedTheme, addItemToSchedule } =
    useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)

  const [itemContent, setItemContent] = useState<PresentationViewItems[] | null>(null)

  const { isOver, setNodeRef } = useDroppable({
    id: 'schedule-drop-area'
  })
  console.log('isOver on schedule', isOver)

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

  const handleDrop = (e: DragEndEvent) => {
    try {
      console.log('droped')
      const data = e.active.data.current
      if (!data) return

      // Check if it's a group template
      if (data.type === 'group-template') {
        // Handle group template drop - TODO: implement group creation in schedule
        console.log('Dropped group template:', data)
        // For now, we'll just log it - later we'll create a schedule group
        alert(`Funcionalidad de grupos en desarrollo. Template: "${data.name}"`)
        return
      }

      // Handle regular items
      addItemToSchedule(data as AddItemToSchedule)
    } catch (error) {
      console.error('Error al procesar drop:', error)
    }
  }

  useDndMonitor({
    onDragEnd: handleDrop
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
      >
        {/* Header con info del schedule */}
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
          <div>
            <h2 className="font-medium">{currentSchedule.title || 'Sin título'}</h2>
          </div>
          <GroupTemplateManager>
            <Button size="sm" className="ml-auto">
              Grupos
            </Button>
          </GroupTemplateManager>

          <Button size="sm" disabled={!pendingSave}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
          <Button size="sm" onClick={onBack}>
            <CalendarSearch className="h-4 w-4" />
            Cronogramas
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4" ref={setNodeRef}>
          {currentSchedule.items.length === 0 ? (
            <EmptyShcedule />
          ) : (
            <div
              className={`min-h-full transition-colors ${
                isOver ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-2' : ''
              }`}
              onClick={() => setSelectedItem(null)}
            >
              <div className="space-y-1">
                {currentSchedule.items.map((item, index) => (
                  <ScheduleItemComponent
                    key={index}
                    item={item}
                    setSelectedItem={setSelectedItem}
                    isSelected={selectedItem?.order === item.order}
                  />
                ))}
              </div>
              {isOver && (
                <div className="mt-4 p-8 border-2 border-dashed border-primary rounded-lg bg-primary/5 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-primary font-medium">Soltar para agregar al final</p>
                </div>
              )}
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
