import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { GetPresentationsDTO } from 'database/controllers/presentations/presentations.dto'

export const usePresentations = (params?: GetPresentationsDTO) => {
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ['presentations', params?.search || ''],
    queryFn: async () => window.api.presentations.getPresentations(params)
  })

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('presentation-saved', () => {
      refetch()
    })

    return unsubscribe
  }, [refetch])

  return {
    presentations: data,
    refetchPresentations: refetch,
    isLoadingPresentations: isLoading
  }
}
