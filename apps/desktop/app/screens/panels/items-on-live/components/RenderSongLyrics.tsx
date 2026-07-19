import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/utils/liveContext'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import RenderSongLyricList from '@/ui/renderSongLyricList'
import useTagSongs from '@/hooks/useTagSongs'
import { Api } from '@ecclesia/queries'

import { useMemo, useRef, useState, useCallback } from 'react'
import { SongLyricDTO } from '@ecclesia/api/src/controllers/songs/songs.dto'

export const RenderSongLyrics = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { itemOnLive, songs } = useSchedule()
  const { itemIndex, setItemIndex } = useLive()
  const { tagSongs } = useTagSongs()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  const selectedSong = useMemo(() => {
    if (itemOnLive?.type === 'SONG') {
      return songs.find((s) => s.id === Number(itemOnLive.accessData))
    }
    return null
  }, [itemOnLive, songs])

  useKeyboardShortcuts(containerRef, {
    onNavigate: (direction) => {
      if (!selectedSong) return
      let newIndex = itemIndex
      if (direction === 'up' || direction === 'left') {
        newIndex = Math.max(0, itemIndex - 1)
      } else if (direction === 'down' || direction === 'right') {
        newIndex = Math.min(selectedSong.lyrics.length - 1, itemIndex + 1)
      }
      setItemIndex(newIndex)
    }
  })

  const handleTagChange = useCallback(
    async (verseIndex: number, newTagId: number | null) => {
      if (!selectedSong) return

      const updatedLyrics = [...selectedSong.lyrics]
      const currentTagId = updatedLyrics[verseIndex]?.tagSongsId ?? null

      if (currentTagId === newTagId) return

      updatedLyrics[verseIndex] = {
        ...updatedLyrics[verseIndex],
        tagSongsId: newTagId
      }

      await Api.fetch.songs.updateSong({
        body: {
          id: selectedSong.id,
          data: {
            title: selectedSong.title,
            author: selectedSong.author,
            copyright: selectedSong.copyright,
            lyrics: updatedLyrics
          }
        }
      })
    },
    [selectedSong]
  )

  const handleGroupTagChange = useCallback(
    async (verseIndex: number, newTagId: number | null) => {
      if (!selectedSong) return

      const currentTagId = selectedSong.lyrics[verseIndex]?.tagSongsId ?? null
      if (currentTagId === newTagId) return

      const updatedLyrics = selectedSong.lyrics.map((lyric, idx) => {
        if (lyric.tagSongsId === currentTagId) {
          return { ...lyric, tagSongsId: newTagId }
        }
        return lyric
      })

      await Api.fetch.songs.updateSong({
        body: {
          id: selectedSong.id,
          data: {
            title: selectedSong.title,
            author: selectedSong.author,
            copyright: selectedSong.copyright,
            lyrics: updatedLyrics
          }
        }
      })
    },
    [selectedSong]
  )

  const extractTextFromHtml = useCallback((html: string): string => {
    const match = html.match(/^<[^>]+>(.*)<\/[^>]+>$/s)
    return match ? match[1] : html
  }, [])

  const wrapTextInHtml = useCallback((originalHtml: string, newText: string): string => {
    const wrapperMatch = originalHtml.match(/^<[^>]+>/)
    const closeMatch = originalHtml.match(/<\/[^>]+>$/)
    if (wrapperMatch && closeMatch) {
      return `${wrapperMatch[0]}${newText}${closeMatch[0]}`
    }
    return newText
  }, [])

  const handleTextSave = useCallback(
    async (verseIndex: number, newText: string) => {
      if (!selectedSong) return

      const originalHtml = selectedSong.lyrics[verseIndex]?.content || ''
      const wrappedText = wrapTextInHtml(originalHtml, newText)

      const updatedLyrics = selectedSong.lyrics.map((lyric, idx) => {
        if (idx === verseIndex) {
          return { ...lyric, content: wrappedText }
        }
        return lyric
      })

      await Api.fetch.songs.updateSong({
        body: {
          id: selectedSong.id,
          data: {
            title: selectedSong.title,
            author: selectedSong.author,
            copyright: selectedSong.copyright,
            lyrics: updatedLyrics
          }
        }
      })
    },
    [selectedSong, wrapTextInHtml]
  )

  const startEditing = useCallback(
    (verseIndex: number) => {
      if (!selectedSong) return
      setEditingIndex(verseIndex)
      const rawContent = selectedSong.lyrics[verseIndex]?.content || ''
      setEditingText(extractTextFromHtml(rawContent))
    },
    [selectedSong, extractTextFromHtml]
  )

  const cancelEditing = useCallback(() => {
    setEditingIndex(null)
    setEditingText('')
  }, [])

  if (!selectedSong) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No se encontró la canción seleccionada.
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col" ref={containerRef}>
      <div className="flex-1 min-h-0 overflow-auto">
        <RenderSongLyricList
          song={selectedSong}
          selectedLyricIndex={itemIndex}
          setSelectedLyricIndex={setItemIndex}
          tagSongs={tagSongs}
          onTagChange={handleTagChange}
          onGroupTagChange={handleGroupTagChange}
          editingIndex={editingIndex}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onStartEditing={startEditing}
          onStopEditing={cancelEditing}
          onTextSave={handleTextSave}
        />
      </div>
    </div>
  )
}
