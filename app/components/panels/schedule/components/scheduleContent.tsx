import { Button } from '@/ui/button'
import { useSchedule } from '@/contexts/ScheduleContext'
import { Save, CalendarSearch, Upload } from 'lucide-react'
import { useState } from 'react'

type ScheduleContentProps = {
  onBack: () => void
}

export default function ScheduleContent({ onBack }: ScheduleContentProps) {
  const { currentSchedule, form } = useSchedule()
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  if (!currentSchedule) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">No hay ningún schedule seleccionado.</p>
      </div>
    )
  }

  const {
    formState: { isDirty },
    setValue
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

      // Determinar el tipo y crear el item apropiado
      const newItem: any = {
        order: (currentSchedule?.items.length || 0) + 1,
        scheduleGroupId: null
      }

      if (droppedItem.type === 'song') {
        newItem.type = 'SONG'
        newItem.accessData = String(droppedItem.accessData)
      } else if (droppedItem.type === 'media') {
        newItem.type = 'MEDIA'
        newItem.accessData = String(droppedItem.accessData)
      } else if (droppedItem.type === 'bible') {
        // Formato: "bookId,chapter,verseStart-verseEnd,version"
        newItem.type = 'BIBLE'
        newItem.accessData = droppedItem.accessData
      } else {
        console.warn('Tipo de item desconocido:', droppedItem.type)
        return
      }

      setValue('items', [...currentSchedule.items, newItem], { shouldDirty: true })
    } catch (error) {
      console.error('Error al procesar drop:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full">
      {/* Header con info del schedule */}
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
        <div>
          <h2 className="font-medium">{currentSchedule.title || 'Sin título'}</h2>
        </div>

        <Button className="ml-auto" size="sm" disabled={!pendingSave}>
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
              isDraggingOver ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'
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
            <div className="space-y-2">
              {currentSchedule.items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-background border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                    <span className="text-sm font-medium">{item.type}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {item.accessData}
                    </span>
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
  )
}
