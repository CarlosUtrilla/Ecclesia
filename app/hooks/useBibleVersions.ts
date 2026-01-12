import { useQuery } from '@tanstack/react-query'


export default function useBibleVersions() {
  const query = useQuery({
    queryKey: ['availableBibles'],
    queryFn: async () => await window.api.bible.getAvailableBibles()
  })
  return query
}
