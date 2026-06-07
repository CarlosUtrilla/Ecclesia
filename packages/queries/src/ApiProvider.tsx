import { createContext, PropsWithChildren, useContext } from 'react'
import type { ApiTypes } from './queriesTypes'
import { exposeRoutes } from './SDK'
import { QueryClient } from '@tanstack/react-query'

const ApiProviderContext = createContext(
  {} as {
    setApiConfiguration: (queryClient: QueryClient, serverUrl?: string, port?: number) => Promise<void>
  }
)

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

export function getApiInstance(): ApiTypes | null {
  return apiInstance
}

export function waitForInit(): Promise<void> {
  return initPromise ?? Promise.resolve()
}

export const initializeApi = (
  queryClient: QueryClient,
  serverUrl = 'http://localhost',
  port = 7777
): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      const sdk = await exposeRoutes(queryClient, serverUrl, port)
      apiInstance = sdk
    })()
  }
  return initPromise
}

export const ApiProvider = ({ children }: PropsWithChildren) => {
  const setApiConfiguration = async (
    queryClient: QueryClient,
    serverUrl = 'http://localhost',
    port = 7777
  ): Promise<void> => {
    const promise = (async () => {
      const sdk = await exposeRoutes(queryClient, serverUrl, port)
      apiInstance = sdk
    })()
    initPromise = promise
    await promise
  }

  return (
    <ApiProviderContext.Provider value={{ setApiConfiguration }}>
      {children}
    </ApiProviderContext.Provider>
  )
}

export function useApiConfiguration() {
  const ctx = useContext(ApiProviderContext)
  if (!ctx.setApiConfiguration) {
    throw new Error('useApiConfiguration debe usarse dentro de un ApiProvider')
  }
  return ctx
}
