import { useDraggable } from '@dnd-kit/core'
import { CalendarPlus, Edit2, FileSliders, Radio, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Card } from '@/ui/card'

type Props = {
  presentation: {
    id: number
    title: string
    slides: { id: string }[]
  }
  isSelected: boolean
  onSelect: () => void
  onAddToSchedule: () => void
  onShowLive: () => void
  onDelete: () => Promise<void>
}

export default function PresentationLibraryItem({
  presentation,
  isSelected,
  onSelect,
  onAddToSchedule,
  onShowLive,
  onDelete
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `presentation-${presentation.id}`,
    data: {
      type: 'PRESENTATION',
      accessData: presentation.id
    }
  })

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={onSelect}
          className={cn('p-2 cursor-pointer border hover:bg-muted/30 transition-colors', {
            'bg-secondary/20 border-secondary': isSelected,
            'opacity-40': isDragging
          })}
        >
          <div className="flex items-center gap-2">
            <FileSliders className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{presentation.title}</p>
              <p className="text-xs text-muted-foreground">
                {presentation.slides.length} diapositivas
              </p>
            </div>
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.windowAPI.openPresentationWindow(presentation.id)}>
          <Edit2 className="size-4" />
          Editar presentación
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddToSchedule}>
          <CalendarPlus className="size-4" />
          Añadir al cronograma
        </ContextMenuItem>
        <ContextMenuItem onClick={onShowLive}>
          <Radio className="size-4 text-green-600" />
          Presentar en vivo
        </ContextMenuItem>
        <ContextMenuItem onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
