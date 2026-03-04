import { Media } from '@prisma/client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BlankTheme } from '@/hooks/useThemes'
import { cn } from '@/lib/utils'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { PresentationView } from '@/ui/PresentationView'
import { Card } from '@/ui/card'
import { PresentationSlide } from '../utils/slideUtils'

type Props = {
  slide: PresentationSlide
  index: number
  isSelected: boolean
  mediaById: Map<number, Media>
  onSelect: () => void
}

export default function SortableSlideCard({
  slide,
  index,
  isSelected,
  mediaById,
  onSelect
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id
  })

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
      }}
      className={cn('w-44 shrink-0 p-1.5 space-y-1.5 cursor-grab active:cursor-grabbing', {
        'border-primary': isSelected,
        'shadow-lg border-primary/50': isDragging
      })}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <PresentationView
        items={[presentationSlideToViewItem(slide, mediaById)]}
        theme={BlankTheme}
        selected={isSelected}
      />
      <div className="text-[11px] text-muted-foreground text-center">Diapositiva {index + 1}</div>
    </Card>
  )
}
