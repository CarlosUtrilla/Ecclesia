import { useQuery } from '@tanstack/react-query'

export default function useBiblePresentationSetting() {
  const { data } = useQuery({
    queryKey: ['bibleSettings'],
    queryFn: async () => await window.api.bible.getBibleSettings(),
    staleTime: Infinity
  })
  return { biblePresentationSettings: data }
}
