import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import RenderSongLyricList from '@/ui/renderSongLyricList'

import { useMemo, useRef } from 'react'

export const RenderSongLyrics = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { itemOnLive, songs } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
  const seletedSong = useMemo(() => {
    if (itemOnLive?.type === 'SONG') {
      return songs.find((s) => s.id === Number(itemOnLive.accessData))
    }
    return null
  }, [itemOnLive, songs])

  useKeyboardShortcuts(containerRef, {
    onNavigate: (direction) => {
      if (!seletedSong) return
      let newIndex = itemIndex
      if (direction === 'up' || direction === 'left') {
        newIndex = Math.max(0, itemIndex - 1)
      } else if (direction === 'down' || direction === 'right') {
        newIndex = Math.min(seletedSong.lyrics.length - 1, itemIndex + 1)
      }
      setItemIndex(newIndex)
    }
  })

  if (!seletedSong) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró la canción seleccionada.
      </div>
    )
  }

  return (
    <div className="h-full" ref={containerRef}>
      <RenderSongLyricList
        song={seletedSong}
        selectedLyricIndex={itemIndex}
        setSelectedLyricIndex={setItemIndex}
      />
    </div>
  )
}
