import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import useTagSongs from '@/hooks/useTagSongs'
import { getContrastTextColor, getGrupedLyrics } from '@/lib/utils'
import { Dot } from 'lucide-react'
import { useMemo } from 'react'

export const RenderSongLyrics = () => {
  const { itemOnLive, songs } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
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
  const lyricIndexes = useMemo(() => {
    let counter = 0
    const indexes: Record<string, number> = {}
    songGruoups.forEach((group) => {
      group.contents.forEach((_, idx) => {
        indexes[`${group.tagSongsId}-${idx}`] = counter
        counter++
      })
    })
    return indexes
  }, [seletedSong, songGruoups])
  return (
    <div className="h-full">
      {songGruoups.map((group, index) => {
        const tagSong = tagSongs.find((t) => t.id === group.tagSongsId)
        return (
          <div key={index} className="relative">
            {tagSong ? (
              <div
                className="w-6 absolute left-0 top-0 bottom-0 p-1 flex flex-col justify-center text-center text-xs leading-4"
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
              {group.contents.map((content, idx) => {
                const index = lyricIndexes[`${group.tagSongsId}-${idx}`]
                const isSelected = index === itemIndex
                const background = tagSong
                  ? `${tagSong.color}${isSelected ? '80' : '40'}`
                  : 'transparent'

                const color = tagSong ? getContrastTextColor(background) : '#000'
                return (
                  <p
                    key={idx}
                    className="transition-colors cursor-pointer border-b py-1 px-2 text-sm relative"
                    style={{
                      backgroundColor: background,
                      color
                    }}
                    onClick={() => setItemIndex(index)}
                  >
                    {escapeHtml(content)}
                    {isSelected ? (
                      <Dot
                        className="absolute right-0 animate-pulse top-1/2 -translate-y-1/2 size-8"
                        style={{ color }}
                      />
                    ) : null}
                  </p>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
