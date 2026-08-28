import { describe, expect, it } from 'vitest'
import {
  API_KEY_SETTING_PREFIX,
  apiKeySettingKey,
  modelSettingKey,
  providerFromApiKeySetting
} from './ai.settings'

describe('ai.settings', () => {
  it('deberia generar una clave de API key distinta por proveedor', () => {
    expect(apiKeySettingKey('openai')).toBe('ai.apiKey.openai')
    expect(apiKeySettingKey('anthropic')).toBe('ai.apiKey.anthropic')
    expect(apiKeySettingKey('openai')).not.toBe(apiKeySettingKey('anthropic'))
  })

  it('deberia generar una clave de modelo distinta por proveedor', () => {
    expect(modelSettingKey('gemini')).toBe('ai.model.gemini')
    expect(modelSettingKey('openrouter')).toBe('ai.model.openrouter')
  })

  it('deberia recuperar el proveedor desde la clave de API key', () => {
    expect(providerFromApiKeySetting('ai.apiKey.opencodego')).toBe('opencodego')
    expect(providerFromApiKeySetting(`${API_KEY_SETTING_PREFIX}gemini`)).toBe('gemini')
  })

  it('deberia ignorar claves que no son de API key por proveedor', () => {
    expect(providerFromApiKeySetting('ai.apiKey')).toBeNull()
    expect(providerFromApiKeySetting('ai.apiKey.')).toBeNull()
    expect(providerFromApiKeySetting('ai.model.openai')).toBeNull()
    expect(providerFromApiKeySetting('logo.fallback.color')).toBeNull()
  })
})
