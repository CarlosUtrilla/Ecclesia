import useTagSongs from '@/hooks/useTagSongs'
import { getContrastTextColor, getGrupedLyrics, sanitizeHTML } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Tooltip } from '@/ui/tooltip'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { Edit2, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

type Props = {
  song: SongResponseDTO
  onDelete: (id: number) => void
}

export default function PreviewSong({ song, onDelete }: Props) {
  const { tagSongs } = useTagSongs()
  const groups = useMemo(() => getGrupedLyrics(song.lyrics), [song])

  return (
    <div className="h-2/5 border-y flex flex-col">
      <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-1 text-sm">
        <h2 className="font-semibold">Vista previa:</h2>{' '}
        <div className="text-muted-foreground italic">{song.title}</div>
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
      <div className="overflow-y-auto flex-1 p-5 text-sm bg-muted/10">
        {groups.map((group, index) => {
          const tag = tagSongs.find((t) => t.id === group.tagSongsId)
          const background = tag ? tag.color + 'db' : undefined
          const color = background ? getContrastTextColor(background) : undefined
          return (
            <div
              key={index}
              className="mb-2 rounded-md p-2"
              style={{
                background,
                color
              }}
            >
              {tag && <h4 className="font-semibold mb-1 italic">{tag.name}</h4>}
              <div className="pl-3">
                {group.contents.map((content, idx) => (
                  <p key={idx} dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
