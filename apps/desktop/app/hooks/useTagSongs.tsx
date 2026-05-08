import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export default function useTagSongs() {
  const { data: tagSongs = [], refetch } = useQuery({
    queryKey: ['tagsSongs'],
    queryFn: async () => await window.api.tagSongs.getAllTagSongs()
  })

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('tags-saved', () => {
      console.log('invalidando query')
      refetch()
    })
    return unsubscribe
  }, [])

  return { tagSongs, refetch }
}
