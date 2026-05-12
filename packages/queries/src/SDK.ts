import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { Fetcher } from './fetcher'

export const exposeRoutes = async (apiUrl: string, port: number) => {
  const queryMap = {} as any
  const mutationMap = {} as any
  const fetchMap = {} as any

  const routes = (await Fetcher(apiUrl, port, '/api/getRoutes')) as [string, string[]][]

  for (const [namespace, Methods] of routes) {
    queryMap[namespace] = {}
    mutationMap[namespace] = {}
    fetchMap[namespace] = {}

    for (const method of Methods) {
      queryMap[namespace][method] = (params?: any) =>
        queryOptions({
          queryKey: [namespace, method, params],

          queryFn: async () => Fetcher(apiUrl, port, `/api/${namespace}/${method}`, params)
        })

      mutationMap[namespace][method] = mutationOptions({
        mutationFn: async (params: any) =>
          Fetcher(apiUrl, port, `/api/${namespace}/${method}`, params)
      })

      fetchMap[namespace][method] = async (params?: any) =>
        Fetcher(apiUrl, port, `/api/${namespace}/${method}`, params)
    }
  }

  return {
    query: queryMap,
    mutation: mutationMap,
    fetch: fetchMap
  }
}
