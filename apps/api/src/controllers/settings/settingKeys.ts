export const SETTING_STORAGE_KEY_BY_PUBLIC_KEY = {
  SALES_DAILY: 'goals.daily',
  SALES_MONTHLY: 'goals.monthly',
  LOGO_FALLBACK_MEDIA_ID: 'logo.fallback.mediaId',
  LOGO_FALLBACK_COLOR: 'logo.fallback.color',
  BIBLE_LIVE_CHUNK_MODE: 'bible.live.chunkMode'
} as const

export type PublicSettingKey = keyof typeof SETTING_STORAGE_KEY_BY_PUBLIC_KEY

const PUBLIC_KEY_BY_STORAGE_KEY = Object.fromEntries(
  Object.entries(SETTING_STORAGE_KEY_BY_PUBLIC_KEY).map(([publicKey, storageKey]) => [
    storageKey,
    publicKey
  ])
) as Record<string, PublicSettingKey>

export function toStorageSettingKey(key: string): string {
  return SETTING_STORAGE_KEY_BY_PUBLIC_KEY[key as PublicSettingKey] || key
}

export function toPublicSettingKey(key: string): string {
  return PUBLIC_KEY_BY_STORAGE_KEY[key] || key
}
