import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { Fetcher } from './fetcher'
import { routes } from '@ecclesia/api/src/routes'
import { ApiTypes } from './queriesTypes'

const exposeRoutes = () => {
  const queryMap = {} as any
  const mutationMap = {} as any

  for (const [namespace, ControllerClass] of Object.entries(routes)) {
    const proto = ControllerClass.prototype as any

    const methods = Object.getOwnPropertyNames(proto).filter(
      (x) => x !== 'constructor' && typeof proto[x] === 'function'
    )

    queryMap[namespace] = {}
    mutationMap[namespace] = {}

    for (const method of methods) {
      queryMap[namespace][method] = (params?: any) =>
        queryOptions({
          queryKey: [namespace, method, params],

          queryFn: async () => Fetcher('/api', `/${namespace}/${method}`, params)
        })

      mutationMap[namespace][method] = () =>
        mutationOptions({
          mutationFn: async (params: any) => Fetcher('/api', `/${namespace}/${method}`, params)
        })
    }
  }

  return {
    query: queryMap,
    mutation: mutationMap
  }
}

export const Api = exposeRoutes() as ApiTypes
