import { useQuery } from '@tanstack/react-query'

export default function useBibleSchema() {
  const { data: bibleSchema = [] } = useQuery({
    queryKey: ['bibleSchema'],
    queryFn: async () => await window.api.bible.getBibleSchema(),
    staleTime: Infinity
  })

  return {
    bibleSchema
  }
}
