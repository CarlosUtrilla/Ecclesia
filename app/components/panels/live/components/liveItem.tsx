import useTagSongs from '@/hooks/useTagSongs'
import ThemesPanel from './themes'
import { useSchedule } from '@/contexts/ScheduleContext'
import { getContrastTextColor, getGrupedLyrics } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Radio } from 'lucide-react'

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
          <h2 className="font-semibold">Elemento en vivo:</h2>
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
            <div className="ml-auto animate-pulse text-sm bg-green-600 text-white rounded-md px-2 py-1 flex items-center gap-1">
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

const RenderSongLyrics = () => {
  const { itemOnLive, songs } = useSchedule()
  const { tagSongs } = useTagSongs()
  const seletedSong = useMemo(() => {
    if (itemOnLive?.type === 'SONG') {
      return songs.find((s) => s.id === Number(itemOnLive.accessData))
    }
    return null
  }, [itemOnLive, songs])
  const songGruoups = useMemo(() => getGrupedLyrics(seletedSong?.lyrics || []), [seletedSong])

  const escapeHtml = (unsafe: string) => {
    //eliminar todas las etiquetas HTML
    return unsafe.replace(/<\/?[^>]+(>|$)/g, '')
  }
  return (
    <div>
      {songGruoups.map((group, index) => {
        const tagSong = tagSongs.find((t) => t.id === group.tagSongsId)
        return (
          <div key={index} className="relative">
            {tagSong ? (
              <div
                className="w-6 absolute left-0 top-0 bottom-0 p-1 flex flex-col justify-center text-center text-sm leading-4"
                style={{
                  backgroundColor: tagSong.color,
                  color: getContrastTextColor(tagSong.color)
                }}
              >
                {tagSong.shortName.split('').map((char, index) => (
                  <div key={index}>{char}</div>
                ))}
              </div>
            ) : null}
            <div className="pl-6">
              {group.contents.map((content, idx) => (
                <p
                  key={idx}
                  className="border-b py-1 px-2 text-sm"
                  style={{
                    backgroundColor: `${tagSong ? tagSong.color + '20' : 'transparent'}`
                  }}
                >
                  {escapeHtml(content)}
                </p>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
