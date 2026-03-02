import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { FileSliders, Plus, Edit2, CalendarPlus, Radio, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/ui/input'
import { Button } from '@/ui/button'
import { cn, generateUniqueId } from '@/lib/utils'
import { usePresentations } from '@/hooks/usePresentations'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Card } from '@/ui/card'
import { BlankTheme } from '@/hooks/useThemes'
import { PresentationView } from '@/ui/PresentationView'
import { presentationSlideToViewItem } from '@/lib/presentationSlides'

export default function PresentationsPanel() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { presentations, isLoadingPresentations, refetchPresentations } = usePresentations({
    search: search || undefined
  })
  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  const selectedPresentation = useMemo(
    () => presentations.find((presentation) => presentation.id === selectedId) || presentations[0],
    [presentations, selectedId]
  )

  const presentationMediaIds = useMemo(() => {
    return Array.from(
      new Set(
        presentations.flatMap((presentation) =>
          presentation.slides.flatMap((slide: any) => {
            if (Array.isArray(slide.items)) {
              return slide.items
                .filter((item: any) => item.type === 'MEDIA' && item.accessData)
                .map((item: any) => Number(item.accessData))
                .filter((id: number) => Number.isFinite(id))
            }

            if (slide.type === 'MEDIA' && slide.mediaId) {
              return [Number(slide.mediaId)]
            }

            return []
          })
        )
      )
    )
  }, [presentations])

  const { data: presentationMedia = [] } = useQuery({
    queryKey: ['presentationLibraryMedia', presentationMediaIds],
    queryFn: async () => window.api.media.getMediaByIds(presentationMediaIds),
    enabled: presentationMediaIds.length > 0
  })

  const presentationMediaById = useMemo(
    () => new Map(presentationMedia.map((mediaItem) => [mediaItem.id, mediaItem])),
    [presentationMedia]
  )

  return (
    <div className="h-full grid grid-cols-[340px_1fr]">
      <div className="border-r panel-scrollable">
        <div className="panel-header p-2 border-b flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar presentación"
          />
          <Button size="icon" onClick={() => window.windowAPI.openPresentationWindow()}>
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="panel-scroll-content p-2 space-y-1">
          {isLoadingPresentations ? (
            <div className="text-sm text-muted-foreground p-2">Cargando presentaciones...</div>
          ) : presentations.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2">No hay presentaciones todavía.</div>
          ) : (
            presentations.map((presentation) => (
              <PresentationLibraryItem
                key={presentation.id}
                isSelected={selectedPresentation?.id === presentation.id}
                onSelect={() => setSelectedId(presentation.id)}
                presentation={presentation}
                onAddToSchedule={() =>
                  addItemToSchedule({ type: 'PRESENTATION', accessData: presentation.id })
                }
                onShowLive={() =>
                  showItemOnLiveScreen(
                    {
                      id: generateUniqueId(),
                      type: 'PRESENTATION',
                      accessData: presentation.id.toString(),
                      order: -1,
                      scheduleId: -1
                    },
                    0
                  )
                }
                onDelete={async () => {
                  const ok = window.confirm('¿Eliminar esta presentación?')
                  if (!ok) return
                  await window.api.presentations.deletePresentation(presentation.id)
                  await refetchPresentations()
                }}
              />
            ))
          )}
        </div>
      </div>

      <div className="panel-scrollable p-3">
        {selectedPresentation ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selectedPresentation.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPresentation.slides.length} diapositiva
                  {selectedPresentation.slides.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button
                onClick={() => window.windowAPI.openPresentationWindow(selectedPresentation.id)}
              >
                <Edit2 className="size-4" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selectedPresentation.slides.slice(0, 8).map((slide) => (
                <PresentationView
                  key={slide.id}
                  items={[presentationSlideToViewItem(slide, presentationMediaById)]}
                  theme={BlankTheme}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type PresentationLibraryItemProps = {
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

function PresentationLibraryItem({
  presentation,
  isSelected,
  onSelect,
  onAddToSchedule,
  onShowLive,
  onDelete
}: PresentationLibraryItemProps) {
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
