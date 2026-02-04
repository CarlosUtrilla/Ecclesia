import { Input } from '@/ui/input'
import { Card } from '@/ui/card'
import { Skeleton } from '@/ui/skeleton'
import t from '@locales'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SongResponseDTO, SongsListResponseDTO } from 'database/controllers/songs/songs.dto'
import { useEffect, useRef, useState } from 'react'
import { Search, Music, Plus, Trash2, Edit2, Radio, CalendarPlus } from 'lucide-react'
import { Button } from '@/ui/button'
import { Tooltip } from '@/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import PreviewSong from './previewSong'
import { cn } from '@/lib/utils'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSchedule } from '@/contexts/ScheduleContext'
import { useLive } from '@/contexts/ScheduleContext/liveContext'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable'

export default function SongsPanelLibrary() {
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<HTMLDivElement>(null)

  const { addItemToSchedule } = useSchedule()
  const { showItemOnLiveScreen } = useLive()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSong, setSelectedSong] = useState<SongResponseDTO | null>(null)

  // Debounce para el buscador
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ['songs', 'libraryPanel', debouncedSearch],
      queryFn: async ({ pageParam = 1 }) => {
        return window.api.songs.getSongsInfiniteScroll({
          page: pageParam,
          limit: 20,
          search: debouncedSearch || undefined
        })
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage: SongsListResponseDTO) => {
        return lastPage.totalPages > lastPage.page ? lastPage.page + 1 : undefined
      }
    })
  useEffect(() => {
    // Refrescar la lista de canciones cuando se guarde una canción
    const unsubscribe = window.electron.ipcRenderer.on('song-saved', async () => {
      const songs = await refetch()
      if (selectedSong) {
        const updatedSong = songs.data?.pages
          .flatMap((page) => page.songs)
          .find((s) => s.id === selectedSong.id)
        setSelectedSong(updatedSong || null)
      }
    })
    return unsubscribe
  }, [selectedSong])
  // Intersection Observer para scroll infinito
  useEffect(() => {
    if (!observerRef.current || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 1.0 }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const allSongs = data?.pages.flatMap((page) => page.songs) ?? []

  const handleDeleteSong = async (songId: number) => {
    const song = allSongs.find((s) => s.id === songId)
    // Primero preguntar al usuario
    const confirm = window.confirm(
      `¿Estás seguro de que deseas eliminar la canción "${song?.title}"?`
    )
    if (!confirm) return
    if (selectedSong?.id === songId) {
      setSelectedSong(null)
    }
    await window.api.songs.deleteSong(songId)
    await refetch()
  }

  useKeyboardShortcuts(containerRef, {
    onNavigate(direction) {
      console.log('navigating', direction)
      if (direction === 'up' || direction === 'down') {
        const currentIndex = allSongs.findIndex((s) => s.id === selectedSong?.id)
        let newIndex = currentIndex
        if (direction === 'down') {
          newIndex = Math.min(currentIndex + 1, allSongs.length - 1)
        } else if (direction === 'up') {
          newIndex = Math.max(currentIndex - 1, 0)
        }
        const newSelectedSong = allSongs[newIndex]
        if (newSelectedSong) {
          setSelectedSong(newSelectedSong)
        }
      }
    }
  })
  return (
    <ResizablePanelGroup direction="horizontal" className="panel-scrollable">
      <ResizablePanel
        className="border-r panel-scrollable"
        defaultSize={'20%'}
        minSize={'15%'}
        maxSize={'35%'}
      >
        {/* Buscador */}
        <div className="panel-header p-2 bg-muted/30 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t('songsPanelLibrary.searchSongs')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 !bg-background"
            />
          </div>
          <Tooltip content={t('songsPanelLibrary.addSong')}>
            <Button size="icon" onClick={() => window.windowAPI.openSongWindow()}>
              <Plus className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {/* Lista de canciones */}
        <div className="panel-scroll-content p-2 space-y-2" ref={containerRef}>
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))
          ) : allSongs.length === 0 ? (
            // Estado vacío
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Music className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {search ? t('songsPanelLibrary.noSongsFound') : t('songsPanelLibrary.noSongs')}
              </p>
              <p className="text-sm">
                {search
                  ? t('songsPanelLibrary.tryAnotherSearch')
                  : t('songsPanelLibrary.addFirstSong')}
              </p>
            </div>
          ) : (
            // Lista de canciones
            <>
              {allSongs.map((song) => (
                <ContextMenu key={song.id}>
                  <ContextMenuTrigger>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            type: 'SONG',
                            accessData: song.id
                          })
                        )
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className={cn(
                        'p-1 px-4 pl-3 hover:bg-muted/30',
                        'cursor-pointer transition-colors',
                        {
                          'bg-secondary/20 hover:bg-secondary/10': selectedSong?.id === song.id
                        }
                      )}
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
                    <ContextMenuItem
                      onClick={() => addItemToSchedule({ type: 'SONG', accessData: song.id })}
                    >
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
              ))}

              {/* Observer para scroll infinito */}
              <div ref={observerRef} className="h-4" />

              {/* Loading más canciones */}
              {isFetchingNextPage && (
                <Card className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              )}
            </>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <PreviewSong song={selectedSong} onDelete={handleDeleteSong} />
    </ResizablePanelGroup>
  )
}
