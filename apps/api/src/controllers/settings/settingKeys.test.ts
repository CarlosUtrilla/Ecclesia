import { describe, expect, it } from 'vitest'
import { toPublicSettingKey, toStorageSettingKey } from './settingKeys'

describe('settingKeys', () => {
  it('deberia mapear claves publicas a claves persistidas', () => {
    expect(toStorageSettingKey('LOGO_FALLBACK_MEDIA_ID')).toBe('logo.fallback.mediaId')
    expect(toStorageSettingKey('BIBLE_LIVE_CHUNK_MODE')).toBe('bible.live.chunkMode')
  })

  it('deberia mapear claves persistidas a claves publicas', () => {
    expect(toPublicSettingKey('logo.fallback.color')).toBe('LOGO_FALLBACK_COLOR')
    expect(toPublicSettingKey('bible.live.chunkMode')).toBe('BIBLE_LIVE_CHUNK_MODE')
  })

  it('deberia dejar pasar claves desconocidas sin romper compatibilidad', () => {
    expect(toStorageSettingKey('CUSTOM_KEY')).toBe('CUSTOM_KEY')
    expect(toPublicSettingKey('custom.key')).toBe('custom.key')
  })
})
