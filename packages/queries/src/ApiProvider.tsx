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

/**
 * Superficie real del SDK. Antes de inicializar, solo se lanza al pedir una de
 * estas: cualquier otra propiedad es introspección (React Refresh mira
 * `$$typeof`/`constructor`, `await` mira `then`, el logger mira `Symbol.toStringTag`…)
 * y lanzar ahí produce «Api not initialized» sin que nadie use la API de verdad,
 * además de romper el HMR del módulo en desarrollo.
 */
const API_SURFACE = new Set(['query', 'mutation', 'fetch', 'socket'])

export const Api = new Proxy(
  {},
  {
    get(_, prop) {
      if (!apiInstance) {
        if (typeof prop !== 'string' || !API_SURFACE.has(prop)) return undefined
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

/**
 * Servidor local por defecto. Se usa la IP de loopback en vez de `localhost`
 * para no depender de la resolución de nombres: sin conexión de red, `localhost`
 * puede resolverse a `::1` o fallar según el estado del resolver del sistema,
 * mientras que `127.0.0.1` siempre es alcanzable.
 */
export const DEFAULT_API_URL = 'http://127.0.0.1'
export const DEFAULT_API_PORT = 7777

/** Espera entre reintentos del bootstrap, en ms; a partir del último se repite. */
const BOOTSTRAP_RETRY_DELAYS_MS = [150, 300, 600, 1200, 2500, 5000]

export function getBootstrapRetryDelay(attempt: number): number {
  const index = Math.min(Math.max(attempt, 1), BOOTSTRAP_RETRY_DELAYS_MS.length) - 1
  return BOOTSTRAP_RETRY_DELAYS_MS[index]
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type InitializeApiOptions = {
  /** Se llama en cada intento fallido, antes de esperar al siguiente. */
  onRetry?: (attempt: number, error: unknown) => void
  /** Máximo de intentos. Por defecto reintenta indefinidamente. */
  maxAttempts?: number
}

/**
 * Arranca el SDK contra el backend local. El backend vive en el proceso
 * principal de Electron y puede tardar en levantar (migraciones, biblias), así
 * que el bootstrap **reintenta** en vez de rendirse al primer fallo: si no,
 * la app se queda sin montar y cualquier uso de `Api` lanza «Api not initialized».
 */
export const initializeApi = (
  queryClient: QueryClient,
  serverUrl = DEFAULT_API_URL,
  port = DEFAULT_API_PORT,
  options: InitializeApiOptions = {}
): Promise<void> => {
  if (!initPromise) {
    const promise = (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          apiInstance = await exposeRoutes(queryClient, serverUrl, port)
          return
        } catch (error) {
          if (options.maxAttempts && attempt >= options.maxAttempts) throw error
          options.onRetry?.(attempt, error)
          await delay(getBootstrapRetryDelay(attempt))
        }
      }
    })()

    // Una promesa rechazada cacheada dejaría la app inservible hasta reiniciar.
    initPromise = promise.catch((error) => {
      initPromise = null
      throw error
    })
  }
  return initPromise
}

export const ApiProvider = ({ children }: PropsWithChildren) => {
  const setApiConfiguration = async (
    queryClient: QueryClient,
    serverUrl = DEFAULT_API_URL,
    port = DEFAULT_API_PORT
  ): Promise<void> => {
    const promise = (async () => {
      const sdk = await exposeRoutes(queryClient, serverUrl, port)
      apiInstance = sdk
    })()
    initPromise = promise.catch((error) => {
      // Si el destino remoto no responde, se conserva el SDK anterior y se
      // permite reintentar en vez de dejar el init cacheado como fallido.
      initPromise = null
      throw error
    })
    await initPromise
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
