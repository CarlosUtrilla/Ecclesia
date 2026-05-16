import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export default function useBiblePresentationSetting() {
  const { data } = useQuery({
    ...Api.query.bible.getDefaultBibleSettings(),
    staleTime: Infinity
  })
  return { biblePresentationSettings: data }
}
