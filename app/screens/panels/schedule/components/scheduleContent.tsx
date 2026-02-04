import { Button } from '@/ui/button'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Save, CalendarSearch, Upload, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScheduleItem } from '@prisma/client'
import { PresentationViewItems } from '@/ui/PresentationView/types'
import { PresentationView } from '@/ui/PresentationView'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import GroupTemplateManager from './GroupTemplateManagerDialog'

type ScheduleContentProps = {
  onBack: () => void
}

export default function ScheduleContent({ onBack }: ScheduleContentProps) {
  const {
    currentSchedule,
    form,
    getScheduleItemContentScreen,
    getScheduleItemIcon,
    getScheduleItemLabel,
    selectedTheme,
    addItemToSchedule
  } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)

    try {
      const data = e.dataTransfer.getData('application/json')
      if (!data) return

      const droppedItem = JSON.parse(data)

      // Check if it's a group template
      if (droppedItem.type === 'group-template') {
        // Handle group template drop - TODO: implement group creation in schedule
        console.log('Dropped group template:', droppedItem.data)
        // For now, we'll just log it - later we'll create a schedule group
        alert(`Funcionalidad de grupos en desarrollo. Template: "${droppedItem.data.name}"`)
        return
      }

      // Handle regular items
      addItemToSchedule(droppedItem)
    } catch (error) {
      console.error('Error al procesar drop:', error)
    }
  }

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

        {/* Contenido del schedule - Drop Area */}
        <div
          className="flex-1 overflow-y-auto p-4"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {currentSchedule.items.length === 0 ? (
            <div
              className={`flex items-center justify-center flex-col text-center p-8 border-2 border-dashed rounded-lg h-full transition-colors ${
                isDraggingOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Upload
                className={`size-16 mb-4 transition-colors ${
                  isDraggingOver ? 'text-primary' : 'text-muted'
                }`}
              />
              <p className={isDraggingOver ? 'text-primary font-medium' : ''}>
                {isDraggingOver ? 'Suelta aquí' : 'Este cronograma no tiene items'}
              </p>
              <p className="text-xs mt-2">
                {isDraggingOver
                  ? 'Agregar al cronograma'
                  : 'Arrastra canciones, medios o versículos desde la biblioteca'}
              </p>
            </div>
          ) : (
            <div
              className={`min-h-full transition-colors ${
                isDraggingOver
                  ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg p-2'
                  : ''
              }`}
            >
              <div className="space-y-1">
                {currentSchedule.items.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 py-1.5 bg-background border rounded-md hover:bg-muted/50 transition-colors',
                      {
                        'border-secondary bg-secondary/10': selectedItem?.order === item.order
                      }
                    )}
                    onClick={() => setSelectedItem(item)}
                    onDoubleClick={() => showItemOnLiveScreen(item, 0)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-primary">{getScheduleItemIcon(item)}</span>
                      <span className="text-sm font-medium">{getScheduleItemLabel(item)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {isDraggingOver && (
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
        <div className="flex flex-col h-5/12">
          <div className="flex justify-between items-center px-2 py-2 border-y bg-muted/20">
            <h3 className="font-medium text-sm italic">Vista previa de pantallas en vivo</h3>
            <Button
              size="sm"
              onClick={() => {
                showItemOnLiveScreen(selectedItem, 0)
                setSelectedItem(null)
              }}
            >
              Presentar en vivo <Radio className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid flex-1 p-2 grid-cols-2 auto-rows-min gap-2 h-full overflow-y-auto">
            {itemContent.map((content, index) => (
              <PresentationView
                tagSongId={(content as any).tagSongId}
                key={index}
                items={[content]}
                theme={selectedTheme}
                onClick={(e) => {
                  //Si es doble click, presentar en vivo
                  if (e.detail === 2) {
                    showItemOnLiveScreen(selectedItem, index)
                  }
                  setSelectedIndex(index)
                }}
                selected={selectedIndex === index}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
