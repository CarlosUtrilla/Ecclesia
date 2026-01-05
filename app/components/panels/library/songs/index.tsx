import { Input } from '@/ui/input'
import { Card } from '@/ui/card'
import { Skeleton } from '@/ui/skeleton'
import t from '@locales'
import { useInfiniteQuery } from '@tanstack/react-query'
import { SongsListResponseDTO } from 'database/controllers/songs/songs.dto'
import { useEffect, useRef, useState } from 'react'
import { Search, Music } from 'lucide-react'

export default function SongsPanelLibrary() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const observerRef = useRef<HTMLDivElement>(null)

  // Debounce para el buscador
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
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
  const totalSongs = data?.pages[0]?.total ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      <div className="p-4 py-2 pt-0 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('songsPanelLibrary.searchSongs')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {totalSongs}{' '}
          {totalSongs === 1 ? t('songsPanelLibrary.song') : t('songsPanelLibrary.songs')}
        </p>
      </div>

      {/* Lista de canciones */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
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
              <Card key={song.id} className="p-4 hover:bg-accent cursor-pointer transition-colors">
                <h3 className="font-semibold text-base">{song.title}</h3>
                <div className="text-sm text-muted-foreground mt-1">
                  {song.artist && <span>{song.artist}</span>}
                  {song.artist && song.author && <span className="mx-2">•</span>}
                  {song.author && <span>{song.author}</span>}
                </div>
              </Card>
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
    </div>
  )
}
