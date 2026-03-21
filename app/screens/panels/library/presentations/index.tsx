import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/ui/input'
import { Button } from '@/ui/button'
import { generateUniqueId } from '@/lib/utils'
import { usePresentations } from '@/hooks/usePresentations'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import PresentationLibraryItem from './components/PresentationLibraryItem'
import PresentationPreview from './components/PresentationPreview'

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

  const { data: presentationMedia = [], refetch: refetchPresentationMedia } = useQuery({
    queryKey: ['presentationLibraryMedia', presentationMediaIds],
    queryFn: async () => window.api.media.getMediaByIds(presentationMediaIds),
    enabled: presentationMediaIds.length > 0
  })

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('presentation-saved', () => {
      refetchPresentationMedia()
    })

    return unsubscribe
  }, [refetchPresentationMedia])

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

        <div className="panel-scroll-content p-2 flex flex-col gap-1">
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
                      scheduleId: -1,
                      updatedAt: new Date(),
                      deletedAt: null
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
          <PresentationPreview
            presentation={selectedPresentation}
            presentationMediaById={presentationMediaById}
          />
        ) : null}
      </div>
    </div>
  )
}
