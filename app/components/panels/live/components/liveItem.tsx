import ThemesPanel from './themes'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useQuery } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { RenderSongLyrics } from './RenderSongLyrics'

export default function LiveItem() {
  const { itemOnLive, getScheduleItemContentScreen } = useSchedule()
  const { data } = useQuery({
    queryKey: ['liveItemContent', itemOnLive?.accessData],
    queryFn: () => {
      return getScheduleItemContentScreen(itemOnLive!)
    },
    enabled: !!itemOnLive
  })

  return (
    <div className="h-full border-r">
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
      <div className="h-7/12">
        {data?.content ? (
          itemOnLive?.type === 'SONG' ? (
            <RenderSongLyrics />
          ) : (
            <div>
              {data.content.map(({ text }) => (
                <div className="border-b py-1 px-2 text-sm" key={text}>
                  {text}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
      <ThemesPanel />
    </div>
  )
}
