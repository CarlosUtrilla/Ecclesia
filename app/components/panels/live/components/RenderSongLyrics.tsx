import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import RenderSongLyricList from '@/ui/renderSongLyricList'

import { useMemo } from 'react'

export const RenderSongLyrics = () => {
  const { itemOnLive, songs } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
  const seletedSong = useMemo(() => {
    if (itemOnLive?.type === 'SONG') {
      return songs.find((s) => s.id === Number(itemOnLive.accessData))
    }
    return null
  }, [itemOnLive, songs])

  if (!seletedSong) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró la canción seleccionada.
      </div>
    )
  }

  return (
    <div className="h-full">
      <RenderSongLyricList
        song={seletedSong}
        selectedLyricIndex={itemIndex}
        setSelectedLyricIndex={setItemIndex}
      />
    </div>
  )
}
