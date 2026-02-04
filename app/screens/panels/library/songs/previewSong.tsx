import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { Button } from '@/ui/button'
import RenderSongLyricList from '@/ui/renderSongLyricList'
import { ResizablePanel } from '@/ui/resizable'
import { Tooltip } from '@/ui/tooltip'
import { ScheduleItemType } from '@prisma/client'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { CalendarPlus, Edit2, Music, Radio, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  song?: SongResponseDTO | null
  onDelete: (id: number) => void
}

export default function PreviewSong({ song, onDelete }: Props) {
  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dataForLive = {
    type: 'SONG' as ScheduleItemType,
    accessData: song?.id.toString() || '',
    id: -1,
    order: -1,
    scheduleGroupId: null,
    scheduleId: -1
  }
  useEffect(() => {
    setSelectedIndex(0)
  }, [song])

  if (!song) {
    return (
      <ResizablePanel>
        <div className="panel-header bg-muted/50 px-4 py-2 border-b flex items-center gap-1 h-12">
          <div className="italic text-sm text-muted-foreground">Ninguna canción seleccionada</div>
        </div>

        <div className="panel-scroll-content flex-col gap-2 text-muted-foreground text-sm bg-muted/10 flex items-center justify-center h-full">
          <Music className="size-16 text-muted" />
          Selecciona una canción para ver su vista previa
        </div>
      </ResizablePanel>
    )
  }
  return (
    <ResizablePanel>
      <div className="panel-header bg-muted/50 px-4 py-2 border-b flex items-center gap-1 h-12">
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
      <div className="panel-scroll-content text-sm bg-muted/10">
        <RenderSongLyricList
          song={song}
          selectedLyricIndex={selectedIndex}
          setSelectedLyricIndex={setSelectedIndex}
          onDoubleClick={(_, index) => showItemOnLiveScreen(dataForLive, index)}
        />
      </div>
    </ResizablePanel>
  )
}
