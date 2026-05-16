import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { GetPresentationsDTO } from '@ecclesia/api/src/controllers/presentations/presentations.dto'
import { Api } from '@ecclesia/queries'

export const usePresentations = (params?: GetPresentationsDTO) => {
  const {
    data = [],
    refetch,
    isLoading
  } = useQuery(Api.query.presentations.getPresentations({ body: params }))

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
