import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

// `exposeRoutes` hace el fetch de bootstrap contra el backend local; se mockea
// para simular un backend que aún no responde.
const exposeRoutes = vi.hoisted(() => vi.fn())
vi.mock('./SDK', () => ({ exposeRoutes }))

const importFreshModule = async () => {
  vi.resetModules()
  return await import('./ApiProvider')
}

const fakeSdk = { query: {}, mutation: {}, fetch: {}, socket: {} }

afterEach(() => {
  vi.useRealTimers()
  exposeRoutes.mockReset()
})

describe('getBootstrapRetryDelay', () => {
  it('debería crecer con los intentos y estabilizarse en el último valor', async () => {
    const { getBootstrapRetryDelay } = await importFreshModule()

    expect(getBootstrapRetryDelay(1)).toBe(150)
    expect(getBootstrapRetryDelay(2)).toBe(300)
    expect(getBootstrapRetryDelay(6)).toBe(5000)
    // Más allá del último tramo se mantiene el máximo, no crece indefinidamente
    expect(getBootstrapRetryDelay(50)).toBe(5000)
  })

  it('debería tratar intentos inválidos como el primero', async () => {
    const { getBootstrapRetryDelay } = await importFreshModule()

    expect(getBootstrapRetryDelay(0)).toBe(150)
    expect(getBootstrapRetryDelay(-3)).toBe(150)
  })
})

describe('initializeApi', () => {
  it('debería apuntar al loopback por IP para no depender del DNS', async () => {
    const { initializeApi, DEFAULT_API_URL, DEFAULT_API_PORT } = await importFreshModule()
    exposeRoutes.mockResolvedValue(fakeSdk)
    const queryClient = new QueryClient()

    await initializeApi(queryClient)

    expect(DEFAULT_API_URL).toBe('http://127.0.0.1')
    expect(exposeRoutes).toHaveBeenCalledWith(queryClient, 'http://127.0.0.1', DEFAULT_API_PORT)
  })

  it('debería reintentar hasta que el backend local responda', async () => {
    const { initializeApi, getApiInstance } = await importFreshModule()
    exposeRoutes
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue(fakeSdk)

    const onRetry = vi.fn()
    await initializeApi(new QueryClient(), undefined, undefined, { onRetry })

    expect(exposeRoutes).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0]).toBe(1)
    expect(getApiInstance()).toBe(fakeSdk)
  })

  it('debería resolver una sola vez aunque se llame en paralelo', async () => {
    const { initializeApi } = await importFreshModule()
    exposeRoutes.mockResolvedValue(fakeSdk)
    const queryClient = new QueryClient()

    await Promise.all([initializeApi(queryClient), initializeApi(queryClient)])

    expect(exposeRoutes).toHaveBeenCalledTimes(1)
  })

  it('no debería dejar cacheado un bootstrap fallido: un reintento posterior funciona', async () => {
    const { initializeApi, getApiInstance } = await importFreshModule()
    exposeRoutes.mockRejectedValueOnce(new Error('sin backend'))

    await expect(
      initializeApi(new QueryClient(), undefined, undefined, { maxAttempts: 1 })
    ).rejects.toThrow('sin backend')
    expect(getApiInstance()).toBeNull()

    exposeRoutes.mockResolvedValue(fakeSdk)
    await initializeApi(new QueryClient())

    expect(getApiInstance()).toBe(fakeSdk)
  })

  it('debería respetar maxAttempts y propagar el último error', async () => {
    const { initializeApi } = await importFreshModule()
    exposeRoutes.mockRejectedValue(new Error('Failed to fetch'))

    await expect(
      initializeApi(new QueryClient(), undefined, undefined, { maxAttempts: 2 })
    ).rejects.toThrow('Failed to fetch')
    expect(exposeRoutes).toHaveBeenCalledTimes(2)
  })
})

describe('Api proxy', () => {
  it('debería lanzar al usar la API antes de inicializarla', async () => {
    const { Api } = await importFreshModule()
    expect(() => Api.fetch).toThrow('Api not initialized')
  })

  it('debería lanzar en toda la superficie real del SDK', async () => {
    const { Api } = await importFreshModule()

    for (const prop of ['query', 'mutation', 'fetch', 'socket'] as const) {
      expect(() => Api[prop]).toThrow('Api not initialized')
    }
  })

  it('no debería lanzar con props de introspección (HMR, await, toString)', async () => {
    const { Api } = await importFreshModule()
    const anyApi = Api as unknown as Record<string, unknown>

    // React Refresh consulta estas al registrar los exports del módulo
    expect(() => anyApi.$$typeof).not.toThrow()
    expect(() => anyApi.constructor).not.toThrow()
    expect(() => (Api as unknown as Record<symbol, unknown>)[Symbol.toStringTag]).not.toThrow()
    // `await Api` consulta `then`: no debe explotar
    expect(() => anyApi.then).not.toThrow()
  })
})
