import { useQuery } from '@tanstack/react-query'

export const useDefaultBiblePresentationSettings = () => {
  const { data } = useQuery({
    queryKey: ['default-bible-presentation-settings'],
    queryFn: async () => {
      return window.api.bible.getDefaultBibleSettings()
    }
  })
  return { defaultBiblePresentationSettings: data }
}
