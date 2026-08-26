import { describe, expect, it } from 'vitest'
import { buildModelsRequest, parseModelsResponse } from './ai.models'
describe('buildModelsRequest', () => {
  it('debería construir la petición de OpenAI con Bearer token', () => {
    const req = buildModelsRequest('openai', 'sk-123')
    expect(req.url).toBe('https://api.openai.com/v1/models')
    expect(req.headers.Authorization).toBe('Bearer sk-123')
  })

  it('debería construir la petición de Anthropic con headers propios', () => {
    const req = buildModelsRequest('anthropic', 'ak-123')
    expect(req.url).toBe('https://api.anthropic.com/v1/models')
    expect(req.headers['x-api-key']).toBe('ak-123')
    expect(req.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('debería construir la petición de Gemini con x-goog-api-key', () => {
    const req = buildModelsRequest('gemini', 'gk-123')
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models')
    expect(req.headers['x-goog-api-key']).toBe('gk-123')
  })

  it('debería permitir listar modelos de OpenRouter sin API key', () => {
    const req = buildModelsRequest('openrouter', null)
    expect(req.url).toBe('https://openrouter.ai/api/v1/models')
    expect(req.headers).toEqual({})
  })

  it('debería incluir Authorization en OpenRouter cuando hay key', () => {
    const req = buildModelsRequest('openrouter', 'ork-123')
    expect(req.headers.Authorization).toBe('Bearer ork-123')
  })

  it('debería construir la petición de OpenCode Go contra zen/go', () => {
    const req = buildModelsRequest('opencodego', 'ogk-123')
    expect(req.url).toBe('https://opencode.ai/zen/go/v1/models')
    expect(req.headers.Authorization).toBe('Bearer ogk-123')
  })
})

describe('parseModelsResponse', () => {
  it('debería extraer IDs de OpenAI y ordenarlos', () => {
    const models = parseModelsResponse('openai', {
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'babbage-002' }]
    })
    expect(models).toEqual(['babbage-002', 'gpt-4o', 'gpt-4o-mini'])
  })

  it('debería extraer IDs de Anthropic', () => {
    const models = parseModelsResponse('anthropic', {
      data: [
        { id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku' },
        { id: 'claude-3-5-sonnet-20241022' }
      ]
    })
    expect(models).toEqual(['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'])
  })

  it('debería quitar el prefijo models/ de Gemini y filtrar los que no soportan generateContent', () => {
    const models = parseModelsResponse('gemini', {
      models: [
        { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }
      ]
    })
    expect(models).toEqual(['gemini-2.0-flash', 'gemini-2.5-pro'])
  })

  it('debería incluir modelos de Gemini sin supportedGenerationMethods', () => {
    const models = parseModelsResponse('gemini', {
      models: [{ name: 'models/gemini-flash-latest' }]
    })
    expect(models).toEqual(['gemini-flash-latest'])
  })

  it('debería extraer IDs de OpenRouter y deduplicar', () => {
    const models = parseModelsResponse('openrouter', {
      data: [{ id: 'openai/gpt-4o-mini' }, { id: 'anthropic/claude-3.5-haiku' }, { id: 'openai/gpt-4o-mini' }]
    })
    expect(models).toEqual(['anthropic/claude-3.5-haiku', 'openai/gpt-4o-mini'])
  })

  it('debería devolver array vacío ante payloads inválidos sin lanzar error', () => {
    expect(parseModelsResponse('openai', null)).toEqual([])
    expect(parseModelsResponse('gemini', {})).toEqual([])
    expect(parseModelsResponse('openrouter', { data: 'no-soy-un-array' })).toEqual([])
  })

  it('debería filtrar entradas sin id válido', () => {
    const models = parseModelsResponse('openai', {
      data: [{ id: '' }, {}, { id: 'gpt-4o' }, null]
    })
    expect(models).toEqual(['gpt-4o'])
  })

  it('debería excluir modelos Responses API de OpenCode Go y conservar los chat/completions', () => {
    const models = parseModelsResponse('opencodego', {
      data: [
        { id: 'claude-opus-5' },
        { id: 'gpt-5.6-sol' },
        { id: 'gemini-3.5-flash' },
        { id: 'grok-4.6' },
        { id: 'muse-spark-1.2' },
        { id: 'muse-spark-1.2-contributor-free' },
        { id: 'glm-5.2' },
        { id: 'kimi-k3' },
        { id: 'qwen3.6-plus' },
        { id: 'deepseek-v4-flash-free' },
        { id: 'big-pickle' },
        { id: 'grok-build-0.1' }
      ]
    })
    expect(models).toEqual([
      'big-pickle',
      'deepseek-v4-flash-free',
      'glm-5.2',
      'grok-build-0.1',
      'kimi-k3',
      'qwen3.6-plus'
    ])
  })
})
