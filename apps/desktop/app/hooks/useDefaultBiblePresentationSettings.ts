import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export const useDefaultBiblePresentationSettings = () => {
  const { data } = useQuery(Api.query.bible.getDefaultBibleSettings())
  return { defaultBiblePresentationSettings: data }
}
