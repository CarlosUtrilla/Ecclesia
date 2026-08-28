import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tabla `Setting` en memoria. El servicio la toca sólo con SQL crudo
 * (`$queryRaw` / `$executeRaw`), así que alcanza con interpretar las tres
 * formas que usa: SELECT por key, SELECT por prefijo (LIKE), UPSERT y DELETE.
 */
const settings = new Map<string, string>()

const sqlTextOf = (query: any): string =>
  typeof query?.sql === 'string' ? query.sql : (query?.strings ?? []).join('?')

const prismaMock = {
  $queryRaw: vi.fn(async (query: any) => {
    const text = sqlTextOf(query)
    const [param] = query.values as string[]

    if (text.includes('LIKE')) {
      const prefix = param.replace(/%$/, '')
      return [...settings.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value }))
    }

    return settings.has(param) ? [{ key: param, value: settings.get(param) }] : []
  }),
  $executeRaw: vi.fn(async (query: any) => {
    const text = sqlTextOf(query)
    const values = query.values as string[]

    if (text.includes('DELETE')) {
      settings.delete(values[0])
      return 1
    }

    settings.set(values[0], values[1])
    return 1
  })
}

vi.mock('../../prisma', () => ({ getPrisma: () => prismaMock }))
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import AIService from './ai.service'

const newService = () => new AIService()

beforeEach(() => {
  settings.clear()
  fetchMock.mockReset()
})

describe('AIService — configuración por proveedor', () => {
  it('deberia guardar la API key bajo la clave del proveedor', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })

    expect(settings.get('ai.apiKey.openai')).toBe('sk-openai')
    expect(settings.get('ai.provider')).toBe('openai')
    expect(settings.has('ai.apiKey')).toBe(false)
  })

  it('no deberia reutilizar la key del proveedor anterior al cambiar de proveedor', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })
    await service.saveProviderConfig({ provider: 'anthropic' })

    const config = await service.getProviderConfig()

    expect(config.provider).toBe('anthropic')
    expect(config.hasKey).toBe(false)
    expect(settings.get('ai.apiKey.openai')).toBe('sk-openai')
    expect(settings.has('ai.apiKey.anthropic')).toBe(false)
  })

  it('deberia recuperar la key y el modelo al volver a un proveedor ya configurado', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai', model: 'gpt-4o' })
    await service.saveProviderConfig({
      provider: 'anthropic',
      apiKey: 'sk-anthropic',
      model: 'claude-3-5-haiku-20241022'
    })
    await service.saveProviderConfig({ provider: 'openai' })

    const config = await service.getProviderConfig()

    expect(config).toMatchObject({ provider: 'openai', model: 'gpt-4o', hasKey: true })
    expect(config.hasKeyByProvider).toMatchObject({
      openai: true,
      anthropic: true,
      gemini: false,
      openrouter: false,
      opencodego: false
    })
  })

  it('deberia usar el modelo por defecto del proveedor cuando no hay uno guardado', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'gemini' })

    const config = await service.getProviderConfig()

    expect(config.model).toBe('gemini-flash-latest')
  })

  it('deberia borrar la key del proveedor cuando se guarda vacía', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })
    await service.saveProviderConfig({ provider: 'openai', apiKey: '   ' })

    expect(settings.has('ai.apiKey.openai')).toBe(false)
    expect((await service.getProviderConfig()).hasKey).toBe(false)
  })

  it('deberia caer al proveedor por defecto si el guardado es desconocido', async () => {
    settings.set('ai.provider', 'proveedor-fantasma')

    const config = await newService().getProviderConfig()

    expect(config.provider).toBe('gemini')
  })
})

describe('AIService — migración de credenciales legacy', () => {
  it('deberia mover la key global al proveedor que estaba activo', async () => {
    settings.set('ai.provider', 'anthropic')
    settings.set('ai.apiKey', 'sk-legacy')
    settings.set('ai.model', 'claude-legacy')

    const config = await newService().getProviderConfig()

    expect(settings.get('ai.apiKey.anthropic')).toBe('sk-legacy')
    expect(settings.get('ai.model.anthropic')).toBe('claude-legacy')
    expect(settings.has('ai.apiKey')).toBe(false)
    expect(settings.has('ai.model')).toBe(false)
    expect(config).toMatchObject({ provider: 'anthropic', model: 'claude-legacy', hasKey: true })
  })

  it('deberia asignar la key legacy a gemini cuando no hay proveedor guardado', async () => {
    settings.set('ai.apiKey', 'sk-legacy')

    await newService().getProviderConfig()

    expect(settings.get('ai.apiKey.gemini')).toBe('sk-legacy')
  })

  it('no deberia pisar una key por proveedor ya existente', async () => {
    settings.set('ai.provider', 'openai')
    settings.set('ai.apiKey.openai', 'sk-nueva')
    settings.set('ai.apiKey', 'sk-legacy')

    await newService().getProviderConfig()

    expect(settings.get('ai.apiKey.openai')).toBe('sk-nueva')
    expect(settings.has('ai.apiKey')).toBe(false)
  })
})

describe('AIService — uso de la key en llamadas al proveedor', () => {
  it('deberia fallar con el nombre del proveedor cuando no tiene key propia', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })
    await service.saveProviderConfig({ provider: 'anthropic' })

    await expect(service.extractFromText('Juan 3:16')).rejects.toThrow(
      /No hay API key configurada para Anthropic/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deberia enviar la key del proveedor activo, no la del anterior', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })
    await service.saveProviderConfig({
      provider: 'anthropic',
      apiKey: 'sk-anthropic',
      model: 'claude-3-5-haiku-20241022'
    })

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"references":[]}' }] })
    })

    await service.extractFromText('Juan 3:16')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('sk-anthropic')
  })

  it('deberia listar modelos con la key del proveedor consultado', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })
    await service.saveProviderConfig({ provider: 'gemini', apiKey: 'sk-gemini' })

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'models/gemini-flash-latest' }] })
    })

    await service.getAvailableModels('gemini')

    const [url, init] = fetchMock.mock.calls[0]
    const serialized = `${url} ${JSON.stringify(init?.headers ?? {})}`
    expect(serialized).toContain('sk-gemini')
    expect(serialized).not.toContain('sk-openai')
  })

  it('deberia rechazar el listado cuando el proveedor consultado no tiene key', async () => {
    const service = newService()
    await service.saveProviderConfig({ provider: 'openai', apiKey: 'sk-openai' })

    await expect(service.getAvailableModels('anthropic')).rejects.toThrow(
      /No hay API key configurada para Anthropic/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
