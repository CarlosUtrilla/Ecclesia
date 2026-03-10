import type { Media } from '@prisma/client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'
import { PresentationView } from '@/ui/PresentationView'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { Card } from '@/ui/card'
import { BASE_CANVAS_HEIGHT, BASE_CANVAS_WIDTH, PresentationSlide } from '../utils/slideUtils'

type Props = {
  slide: PresentationSlide
  index: number
  isSelected: boolean
  mediaById: Map<number, Media>
  themeById: Map<number, ThemeWithMedia>
  activeTheme: ThemeWithMedia
  onSelect: () => void
}

export default function SortableSlideCard({
  slide,
  index,
  isSelected,
  mediaById,
  themeById,
  activeTheme,
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
      className={cn('w-36 shrink-0 p-1.5 cursor-grab active:cursor-grabbing', {
        'border-primary': isSelected,
        'shadow-lg border-primary/50': isDragging
      })}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="relative w-full overflow-hidden rounded-sm border border-border/60">
        <PresentationView
          items={[presentationSlideToViewItem(slide, mediaById, themeById)]}
          theme={activeTheme}
          customAspectRatio={`${BASE_CANVAS_WIDTH} / ${BASE_CANVAS_HEIGHT}`}
        />
        <div className="absolute left-1.5 bottom-1.5 rounded-sm bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground leading-none">
          Diapositiva {index + 1}
        </div>
      </div>
    </Card>
  )
}
