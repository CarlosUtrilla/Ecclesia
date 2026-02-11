import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { CalendarPlus, Edit2, Music, Radio, Trash2 } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'

type Props = {
  song: SongResponseDTO
  selectedSong: SongResponseDTO | null
  setSelectedSong: (song: SongResponseDTO | null) => void
  handleDeleteSong: (songId: number) => void
}

export default function SongItem({ song, selectedSong, setSelectedSong, handleDeleteSong }: Props) {
  const dragData = {
    type: 'SONG',
    accessData: song.id
  }

  console.log('🎵 SongItem dragging:', {
    songId: song.id,
    songTitle: song.title,
    uniqueId: `song-${song.id}`
  })

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `song-${song.id}`,
    data: dragData
  })

  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  return (
    <ContextMenu key={song.id}>
      <ContextMenuTrigger>
        <div
          className={cn('p-1 px-4 pl-3 hover:bg-muted/30', 'cursor-pointer transition-colors', {
            'bg-secondary/20 hover:bg-secondary/10': selectedSong?.id === song.id,
            'opacity-50 bg-muted ': isDragging
          })}
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={() => setSelectedSong(song)}
          onDoubleClick={() => addItemToSchedule({ type: 'SONG', accessData: song.id })}
        >
          <h3 className="font-semibold text-base flex gap-2 items-center">
            <Music className="h-4 w-4 text-muted-foreground" />
            {song.title}
            {song.author ? (
              <div className="text-sm text-muted-foreground mt-1">
                ({song.author && <span>{song.author}</span>})
              </div>
            ) : null}
          </h3>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.windowAPI.openSongWindow(song.id)}>
          <Edit2 />
          Editar canción
        </ContextMenuItem>
        <ContextMenuItem onClick={() => addItemToSchedule({ type: 'SONG', accessData: song.id })}>
          <CalendarPlus />
          Añadir canción al cronograma
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            showItemOnLiveScreen(
              {
                accessData: song.id.toString(),
                type: 'SONG',
                id: -1,
                order: -1,
                scheduleGroupId: null,
                scheduleId: -1
              },
              0
            )
          }
        >
          <Radio className="text-green-600" />
          Presentar canción en vivo
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleDeleteSong(song.id)}>
          <Trash2 className="text-destructive" />
          Eliminar canción
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
