import useTagSongs from '@/hooks/useTagSongs'
import { cn, getContrastTextColor, getGrupedLyrics } from '@/lib/utils'
import { SongResponseDTO } from 'database/controllers/songs/songs.dto'
import { useMemo } from 'react'

type Props = {
  song: SongResponseDTO
  selectedLyricIndex?: number
  setSelectedLyricIndex?: (index: number) => void
  onLyricClick?: (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, index: number) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, index: number) => void
}
export default function RenderSongLyricList({
  song,
  selectedLyricIndex,
  setSelectedLyricIndex,
  onLyricClick,
  onDoubleClick
}: Props) {
  const songGruoups = useMemo(() => getGrupedLyrics(song?.lyrics || []), [song])

  const { tagSongs } = useTagSongs()

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
  }, [song, songGruoups])

  const escapeHtml = (unsafe: string) => {
    //eliminar todas las etiquetas HTML
    return unsafe.replace(/<\/?[^>]+(>|$)/g, '')
  }

  return songGruoups.map((group, index) => {
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
            const isSelected = index === selectedLyricIndex
            const background = tagSong
              ? `${tagSong.color}${isSelected ? '80' : '40'}`
              : 'transparent'

            const color = tagSong ? getContrastTextColor(background) : '#000'
            return (
              <p
                key={idx}
                className={cn(
                  'transition-colors cursor-pointer border-b py-1 px-2 text-sm relative',
                  {
                    'border border-secondary': isSelected
                  }
                )}
                style={{
                  backgroundColor: background,
                  color
                }}
                onClick={(e) => {
                  if (setSelectedLyricIndex) setSelectedLyricIndex(index)
                  if (onLyricClick) onLyricClick(e, index)
                }}
                onDoubleClick={(e) => {
                  if (onDoubleClick) onDoubleClick(e, index)
                }}
              >
                {escapeHtml(content)}
              </p>
            )
          })}
        </div>
      </div>
    )
  })
}
