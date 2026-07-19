import { cn, getContrastTextColor, getGrupedLyrics } from '@/lib/utils'
import { SongResponseDTO, SongLyricDTO } from '@ecclesia/api/src/controllers/songs/songs.dto'
import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Edit2, Tag, Check, X } from 'lucide-react'

type TagSong = {
  id: number
  name: string
  shortName: string
  color: string
}

type Props = {
  song: SongResponseDTO
  selectedLyricIndex?: number
  setSelectedLyricIndex?: (index: number) => void
  onLyricClick?: (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, index: number) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLParagraphElement, MouseEvent>, index: number) => void
  tagSongs?: TagSong[]
  onTagChange?: (verseIndex: number, newTagId: number | null) => void
  onGroupTagChange?: (verseIndex: number, newTagId: number | null) => void
  editingIndex?: number | null
  editingText?: string
  onEditingTextChange?: (text: string) => void
  onStartEditing?: (verseIndex: number) => void
  onStopEditing?: () => void
  onTextSave?: (verseIndex: number, newText: string) => void
}
export default function RenderSongLyricList({
  song,
  selectedLyricIndex,
  setSelectedLyricIndex,
  onLyricClick,
  onDoubleClick,
  tagSongs = [],
  onTagChange,
  onGroupTagChange,
  editingIndex,
  editingText,
  onEditingTextChange,
  onStartEditing,
  onStopEditing,
  onTextSave
}: Props) {
  const songGroups = useMemo(() => getGrupedLyrics(song?.lyrics || []), [song])

  const lyricIndexes = useMemo(() => {
    let counter = 0
    const indexes: Record<string, number> = {}
    songGroups.forEach((group) => {
      group.contents.forEach((_, idx) => {
        indexes[`${group.tagSongsId}-${idx}`] = counter
        counter++
      })
    })
    return indexes
  }, [song, songGroups])

  const indexToKey = useMemo(() => {
    const map: Record<number, { tagSongsId: number | null; localIndex: number }> = {}
    let counter = 0
    songGroups.forEach((group) => {
      group.contents.forEach((_, idx) => {
        map[counter] = { tagSongsId: group.tagSongsId, localIndex: idx }
        counter++
      })
    })
    return map
  }, [songGroups])

  const simpleEscapeHtml = (unsafe: string) => {
    return unsafe.replace(/<\/?[^>]+(>|$)/g, '')
  }

  const editingInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIndex !== null && editingInputRef.current) {
      editingInputRef.current.focus()
      editingInputRef.current.select()
    }
  }, [editingIndex])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, verseIndex: number) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (onTextSave && editingText !== undefined) {
          onTextSave(verseIndex, editingText)
        }
        onStopEditing?.()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onStopEditing?.()
      }
    },
    [onTextSave, onStopEditing, editingText]
  )

  return songGroups.map((group, groupIndex) => {
    const tagSong = tagSongs.find((t) => t.id === group.tagSongsId)
    return (
      <div key={`group-${group.tagSongsId}-${groupIndex}`} className="relative">
        {tagSong ? (
          <div
            className="w-6 absolute left-0 top-0 bottom-0 p-1 flex flex-col justify-center text-center text-xs leading-4"
            style={{
              backgroundColor: tagSong.color,
              color: getContrastTextColor(tagSong.color)
            }}
          >
            {tagSong.shortName.split('').map((char, charIdx) => (
              <div key={`${char}-${charIdx}`}>{char}</div>
            ))}
          </div>
        ) : null}
        <div className="pl-6">
          {group.contents.map((content, idx) => {
            const key = `${group.tagSongsId}-${idx}`
            const verseIndex = lyricIndexes[key]
            const isSelected = verseIndex === selectedLyricIndex
            const isEditing = verseIndex === editingIndex
            const background = tagSong
              ? `${tagSong.color}${isSelected ? '80' : '40'}`
              : 'transparent'

            const color = getContrastTextColor(background)

            if (isEditing) {
              return (
                <div
                  key={key}
                  className="flex items-center gap-1 border-b py-1 px-2"
                  style={{ backgroundColor: background, color }}
                >
                  <input
                    ref={editingInputRef}
                    type="text"
                    value={editingText || ''}
                    onChange={(e) => onEditingTextChange?.(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, verseIndex)}
                    className="flex-1 bg-transparent border border-current rounded px-1 text-sm outline-none"
                    style={{ color }}
                  />
                  <button
                    onClick={() => {
                      if (onTextSave && editingText !== undefined) {
                        onTextSave(verseIndex, editingText)
                      }
                      onStopEditing?.()
                    }}
                    className="p-0.5 hover:bg-white/20 rounded"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={onStopEditing}
                    className="p-0.5 hover:bg-white/20 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            }

            return (
              <ContextMenu key={key}>
                <ContextMenuTrigger>
                  <p
                    id={key}
                    className={cn(
                      'transition-colors cursor-pointer border-b py-1 px-2 text-sm relative',
                      {
                        'border border-secondary': isSelected
                      }
                    )}
                    role="button"
                    tabIndex={0}
                    style={{
                      backgroundColor: background,
                      color
                    }}
                    onClick={(e) => {
                      if (setSelectedLyricIndex) setSelectedLyricIndex(verseIndex)
                      if (onLyricClick) onLyricClick(e, verseIndex)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (setSelectedLyricIndex) setSelectedLyricIndex(verseIndex)
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (onDoubleClick) onDoubleClick(e, verseIndex)
                    }}
                  >
                    {simpleEscapeHtml(content)}
                  </p>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onStartEditing?.(verseIndex)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Editar texto
                  </ContextMenuItem>
                  {onTagChange && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Tag className="mr-2 h-4 w-4" />
                          Cambiar tag (este verso)
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          <ContextMenuItem
                            onClick={() => onTagChange(verseIndex, null)}
                            className={!group.tagSongsId ? 'bg-muted' : ''}
                          >
                            Sin tag
                          </ContextMenuItem>
                          {tagSongs.map((tag) => (
                            <ContextMenuItem
                              key={tag.id}
                              onClick={() => onTagChange(verseIndex, tag.id)}
                              className={group.tagSongsId === tag.id ? 'bg-muted' : ''}
                            >
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </>
                  )}
                  {onGroupTagChange && group.contents.length > 1 && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Tag className="mr-2 h-4 w-4" />
                          Cambiar tag (grupo: {group.contents.length} versos)
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          <ContextMenuItem
                            onClick={() => onGroupTagChange(verseIndex, null)}
                            className={!group.tagSongsId ? 'bg-muted' : ''}
                          >
                            Sin tag
                          </ContextMenuItem>
                          {tagSongs.map((tag) => (
                            <ContextMenuItem
                              key={tag.id}
                              onClick={() => onGroupTagChange(verseIndex, tag.id)}
                              className={group.tagSongsId === tag.id ? 'bg-muted' : ''}
                            >
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </div>
    )
  })
}
