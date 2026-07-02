import { Plus, Minus, Plus as PlusIcon } from 'lucide-react'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'
import { Label } from '@/ui/label'
import { Card } from '@/ui/card'
import SortableSlideCard from './sortableSlideCard'
import SlideInsertSlot from './slideInsertSlot'
import type { Media } from '@ecclesia/api'
import type { ThemeWithMedia } from '@/ui/PresentationView/types'
import type { PresentationFormValues } from '../schema'

type Props = {
  slides: PresentationFormValues['slides']
  selectedSlideIndex: number
  onSelectSlide: (index: number) => void
  onAddEmptySlide: () => void
  onInsertEmptySlideAt: (index: number) => void
  onDuplicateSlide: (index: number) => void
  onDeleteSlide: (index: number) => void
  onRenameSlide: (index: number) => void
  onSlidesDragEnd: (event: DragEndEvent) => void
  mediaById: Map<number, Media>
  themeById: Map<number, ThemeWithMedia>
  activePresentationTheme: ThemeWithMedia
  canvasZoom: number
  onZoomChange: (value: number) => void
  onHoverChange?: (hovered: boolean) => void
}

export default function SlideTray({
  slides,
  selectedSlideIndex,
  onSelectSlide,
  onAddEmptySlide,
  onInsertEmptySlideAt,
  onDuplicateSlide,
  onDeleteSlide,
  onRenameSlide,
  onSlidesDragEnd,
  mediaById,
  themeById,
  activePresentationTheme,
  canvasZoom,
  onZoomChange,
  onHoverChange
}: Props) {
  const minCanvasZoom = 50
  const maxCanvasZoom = 200

  const clampCanvasZoom = (value: number) =>
    Math.min(maxCanvasZoom, Math.max(minCanvasZoom, Math.round(value)))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const slideSortableIndex = slides.map((slide) => slide.id)

  return (
    <div className="flex-shrink-0 px-2.5 py-2 bg-muted/50 border-t">
      <div className="flex items-end gap-3">
        <div
          className="min-w-0 flex-1 overflow-x-auto pb-1"
          onMouseEnter={() => onHoverChange?.(true)}
          onMouseLeave={() => onHoverChange?.(false)}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onSlidesDragEnd}
          >
            <SortableContext items={slideSortableIndex} strategy={horizontalListSortingStrategy}>
              <div className="flex items-center gap-1.5">
                <SlideInsertSlot onInsert={() => onInsertEmptySlideAt(0)} />
                {slides.map((slide, index) => (
                  <div key={slide.id} className="flex items-center gap-1.5">
                    <SortableSlideCard
                      slide={slide}
                      index={index}
                      mediaById={mediaById}
                      themeById={themeById}
                      activeTheme={activePresentationTheme}
                      isSelected={selectedSlideIndex === index}
                      onDuplicate={() => onDuplicateSlide(index)}
                      onDelete={() => onDeleteSlide(index)}
                      onRename={() => onRenameSlide(index)}
                      onSelect={() => onSelectSlide(index)}
                    />
                    <SlideInsertSlot onInsert={() => onInsertEmptySlideAt(index + 1)} />
                  </div>
                ))}
                <Card
                  className="w-36 shrink-0 p-1.5 h-full min-h-24 border-dashed cursor-pointer hover:border-primary/70 transition-colors"
                  onClick={onAddEmptySlide}
                >
                  <div className="h-full min-h-16 flex flex-col items-center justify-center text-muted-foreground gap-1.5">
                    <Plus className="size-5" />
                    <span className="text-xs">Nueva diapositiva</span>
                  </div>
                </Card>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="shrink-0 rounded-md border bg-background/70 px-2 py-1.5 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Zoom</Label>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            onClick={() => onZoomChange(clampCanvasZoom(canvasZoom - 10))}
            aria-label="Reducir zoom del canvas"
          >
            <Minus className="size-4" />
          </Button>
          <Slider
            value={[canvasZoom]}
            min={minCanvasZoom}
            max={maxCanvasZoom}
            step={5}
            className="w-40"
            onValueChange={(value) => onZoomChange(clampCanvasZoom(value[0] ?? 100))}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            onClick={() => onZoomChange(clampCanvasZoom(canvasZoom + 10))}
            aria-label="Aumentar zoom del canvas"
          >
            <PlusIcon className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-11 text-right">
            {canvasZoom}%
          </span>
        </div>
      </div>
    </div>
  )
}
