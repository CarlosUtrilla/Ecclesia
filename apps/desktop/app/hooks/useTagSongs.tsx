import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export default function useTagSongs() {
  const { data: tagSongs = [], refetch } = useQuery(Api.query.tagSongs.getAllTagSongs())

  return { tagSongs, refetch }
}
