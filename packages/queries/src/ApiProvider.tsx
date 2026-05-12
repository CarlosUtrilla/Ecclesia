import { createContext, PropsWithChildren } from 'react'
import type { ApiTypes } from './queriesTypes'
import { exposeRoutes } from './SDK'

const ApiProviderContext = createContext({} as any)

let apiInstance: ApiTypes | null = null

export const Api = new Proxy(
  {},
  {
    get(_, prop) {
      if (!apiInstance) {
        throw new Error('Api not initialized')
      }

      return apiInstance[prop as keyof ApiTypes]
    }
  }
) as ApiTypes

let initPromise: Promise<void> | null = null

export const initializeApi = (serverUrl = 'http://localhost', port = 7777): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      const sdk = await exposeRoutes(serverUrl, port)
      apiInstance = sdk
    })()
  }
  return initPromise
}

export const ApiProvider = ({ children }: PropsWithChildren) => {
  return <ApiProviderContext.Provider value={{}}>{children}</ApiProviderContext.Provider>
}
