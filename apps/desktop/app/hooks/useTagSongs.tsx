import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export default function useTagSongs() {
  const { data: tagSongs = [], refetch } = useQuery(Api.query.tagSongs.getAllTagSongs())

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('tags-saved', () => {
      console.log('invalidando query')
      refetch()
    })
    return unsubscribe
  }, [])

  return { tagSongs, refetch }
}
