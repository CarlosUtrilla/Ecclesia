import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { RenderSongLyrics } from './components/RenderSongLyrics'
import RenderBibleVerses from './components/RenderBibleVerses'
import ThemesPanel from './components/themes'
export default function LivePanel() {
  const { itemOnLive, getScheduleItemContentScreen } = useSchedule()
  const { data } = useQuery({
    queryKey: ['liveItemContent', itemOnLive?.accessData],
    queryFn: () => {
      return getScheduleItemContentScreen(itemOnLive!)
    },
    enabled: !!itemOnLive
  })

  const renderContent = () => {
    const content = data!.content
    switch (itemOnLive!.type) {
      case 'SONG':
        return <RenderSongLyrics />
      case 'BIBLE':
        return <RenderBibleVerses data={content} />
      default:
        return <div className="p-4 text-sm text-muted-foreground">Vista previa no disponible.</div>
    }
  }

  return (
    <div className="h-full min-w-1/3">
      <div className="min-h-92">
        <div>
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2 text-sm">
            <div className="text-muted-foreground italic">
              <span>
                {itemOnLive ? (
                  <>
                    {itemOnLive.type === 'SONG'
                      ? 'Canción'
                      : itemOnLive.type === 'BIBLE'
                        ? 'Biblia'
                        : itemOnLive.type === 'MEDIA'
                          ? 'Multimedia'
                          : 'Otro contenido'}
                  </>
                ) : (
                  'Ningún elemento en vivo'
                )}{' '}
                {data?.title ? `- ${data.title}` : ''}
              </span>
            </div>
            {itemOnLive ? (
              <div className="text-nowrap ml-auto animate-pulse text-sm bg-green-600 text-white rounded-md px-2 py-1 flex items-center gap-1">
                <Radio className="size-6" /> En vivo
              </div>
            ) : null}
          </div>
        </div>
        {data?.content ? renderContent() : null}
      </div>
      <ThemesPanel />
    </div>
  )
}
