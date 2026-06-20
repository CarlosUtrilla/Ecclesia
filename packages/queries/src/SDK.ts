import { mutationOptions, QueryClient, queryOptions } from '@tanstack/react-query'
import { Fetcher } from './fetcher'
import { createSocketProxy } from './socket'

export const exposeRoutes = async (queryClient: QueryClient, apiUrl: string, port: number) => {
  const queryMap = {} as any
  const mutationMap = {} as any
  const fetchMap = {} as any

  const routes = (await Fetcher({ apiUrl, port, path: '/api/getRoutes' })) as [string, string[]][]

  for (const [namespace, Methods] of routes) {
    queryMap[namespace] = {}
    mutationMap[namespace] = {}
    fetchMap[namespace] = {}

    for (const method of Methods) {
      queryMap[namespace][method] = (params?: any) =>
        queryOptions({
          queryKey: [namespace, method, params],

          queryFn: async () =>
            Fetcher({
              apiUrl,
              port,
              path: `/api/${namespace}/${method}`,
              body: params
            })
        })

      mutationMap[namespace][method] = mutationOptions({
        mutationFn: async (params: any) =>
          Fetcher({ apiUrl, port, path: `/api/${namespace}/${method}`, body: params })
      })

      fetchMap[namespace][method] = async (params?: any) =>
        Fetcher({ apiUrl, port, path: `/api/${namespace}/${method}`, body: params })
    }
  }

  return {
    query: queryMap,
    mutation: mutationMap,
    fetch: fetchMap,
    socket: createSocketProxy(apiUrl, port)
  }
}
