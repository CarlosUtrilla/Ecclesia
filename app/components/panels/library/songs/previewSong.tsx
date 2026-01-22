import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import { Button } from '@/ui/button'
import RenderSongLyricList from '@/ui/renderSongLyricList'
import { Tooltip } from '@/ui/tooltip'
import { ScheduleItemType } from '@prisma/client'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { CalendarPlus, Edit2, Radio, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  song: SongResponseDTO
  onDelete: (id: number) => void
}

export default function PreviewSong({ song, onDelete }: Props) {
  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dataForLive = {
    type: 'SONG' as ScheduleItemType,
    accessData: song.id.toString(),
    id: -1,
    order: -1,
    scheduleGroupId: null,
    scheduleId: -1
  }
  useEffect(() => {
    setSelectedIndex(0)
  }, [song])
  return (
    <div className="h-2/5 border-y flex flex-col">
      <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-1">
        <div className="font-medium italic">{song.title}</div>
        <div className="ml-auto flex gap-1">
          <Tooltip content="Editar canción">
            <Button
              size="icon"
              className="size-8"
              onClick={() => window.windowAPI.openSongWindow(song.id)}
            >
              <Edit2 className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Añadir canción al cronograma">
            <Button
              size="icon"
              className="size-8"
              onClick={() => addItemToSchedule({ type: 'SONG', accessData: song.id })}
            >
              <CalendarPlus className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Presentar canción en vivo">
            <Button
              size="icon"
              className="size-8"
              onClick={() => showItemOnLiveScreen(dataForLive, 0)}
            >
              <Radio className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Eliminar canción">
            <Button
              size="icon"
              variant="destructive"
              className="size-8"
              onClick={() => onDelete && onDelete(song.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 text-sm bg-muted/10">
        <RenderSongLyricList
          song={song}
          selectedLyricIndex={selectedIndex}
          setSelectedLyricIndex={setSelectedIndex}
          onDoubleClick={(_, index) => showItemOnLiveScreen(dataForLive, index)}
        />
      </div>
    </div>
  )
}
