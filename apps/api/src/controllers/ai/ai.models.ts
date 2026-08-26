import { AIProvider, AI_PROVIDER_DEFAULTS } from './ai.types'

export type ModelsRequest = {
  url: string
  headers: Record<string, string>
}

/**
 * Construye la petición de listado de modelos según el proveedor.
 * OpenRouter no requiere key para listar (catálogo público), el resto sí.
 */
export function buildModelsRequest(provider: AIProvider, apiKey: string | null): ModelsRequest {
  switch (provider) {
    case 'openai':
      return {
        url: `${AI_PROVIDER_DEFAULTS.openai.baseUrl}/models`,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      }
    case 'anthropic':
      return {
        url: `${AI_PROVIDER_DEFAULTS.anthropic.baseUrl}/v1/models`,
        headers: { 'x-api-key': apiKey ?? '', 'anthropic-version': '2023-06-01' }
      }
    case 'gemini':
      return {
        url: `${AI_PROVIDER_DEFAULTS.gemini.baseUrl}/models`,
        headers: { 'x-goog-api-key': apiKey ?? '' }
      }
    case 'openrouter':
      return {
        url: `${AI_PROVIDER_DEFAULTS.openrouter.baseUrl}/models`,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      }
    case 'opencodego':
      return {
        url: `${AI_PROVIDER_DEFAULTS.opencodego.baseUrl}/models`,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      }
  }
}

/**
 * OpenCode Zen expone dos APIs según la familia del modelo: los GPT/Claude/Gemini/Grok
 * usan la Responses API (`/v1/responses`) y los abiertos (GLM, Kimi, DeepSeek, MiniMax,
 * Qwen y los free) usan chat/completions, que es lo único que habla este cliente.
 * Filtramos por prefijo de familia según la tabla oficial de endpoints de Zen.
 */
const ZEN_RESPONSES_API_PREFIX = /^(gpt-|claude-|gemini-|grok-\d|muse-spark)/

export function isZenResponsesApiModel(id: string): boolean {
  return ZEN_RESPONSES_API_PREFIX.test(id)
}

/**
 * Normaliza la respuesta de cada proveedor a un array de IDs ordenado alfabéticamente.
 * - openai/openrouter: `{ data: [{ id }] }`
 * - anthropic: `{ data: [{ id }] }`
 * - gemini: `{ models: [{ name: "models/xxx", supportedGenerationMethods }] }` → filtra los que
 *   no soportan generateContent y quita el prefijo `models/`.
 */
export function parseModelsResponse(provider: AIProvider, payload: unknown): string[] {
  const data = payload as any

  let models: string[] = []

  switch (provider) {
    case 'openai':
    case 'anthropic':
    case 'openrouter': {
      const rows = Array.isArray(data?.data) ? data.data : []
      models = rows.map((row: any) => String(row?.id ?? '')).filter(Boolean)
      break
    }
    case 'opencodego': {
      const rows = Array.isArray(data?.data) ? data.data : []
      models = rows
        .map((row: any) => String(row?.id ?? ''))
        .filter((id: string) => id && !isZenResponsesApiModel(id))
      break
    }
    case 'gemini': {
      const rows = Array.isArray(data?.models) ? data.models : []
      models = rows
        .filter(
          (row: any) =>
            !Array.isArray(row?.supportedGenerationMethods) ||
            row.supportedGenerationMethods.includes('generateContent')
        )
        .map((row: any) => String(row?.name ?? '').replace(/^models\//, ''))
        .filter(Boolean)
      break
    }
  }

  return [...new Set(models)].sort((a, b) => a.localeCompare(b))
}
