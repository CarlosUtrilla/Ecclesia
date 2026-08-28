import { AIProvider } from './ai.types'

/** Proveedor activo. Es global, no depende del proveedor. */
export const AI_PROVIDER_SETTING = 'ai.provider'

/**
 * Claves legacy: guardaban una sola API key y un solo modelo para toda la app,
 * asi que al cambiar de proveedor se reusaba la credencial del anterior.
 * Se migran a claves por proveedor y se borran (ver `migrateLegacyProviderSettings`).
 */
export const LEGACY_API_KEY_SETTING = 'ai.apiKey'
export const LEGACY_MODEL_SETTING = 'ai.model'

/** Prefijo usado para leer todas las keys guardadas de una sola query. */
export const API_KEY_SETTING_PREFIX = 'ai.apiKey.'
export const MODEL_SETTING_PREFIX = 'ai.model.'

export function apiKeySettingKey(provider: AIProvider): string {
  return `${API_KEY_SETTING_PREFIX}${provider}`
}

export function modelSettingKey(provider: AIProvider): string {
  return `${MODEL_SETTING_PREFIX}${provider}`
}

/**
 * Devuelve el proveedor a partir de una clave `ai.apiKey.<provider>`,
 * o `null` si la clave no tiene ese formato.
 */
export function providerFromApiKeySetting(key: string): AIProvider | null {
  if (!key.startsWith(API_KEY_SETTING_PREFIX)) return null
  const provider = key.slice(API_KEY_SETTING_PREFIX.length)
  return provider ? (provider as AIProvider) : null
}
