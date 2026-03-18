import { getPrisma } from '../../../electron/main/prisma'
import { Prisma } from '@prisma/client'
import { SettingsUpdateDTO } from './settings.dto'
import { toPublicSettingKey, toStorageSettingKey } from './settingKeys'

type SettingRow = {
  id: number
  key: string
  value: string
  createdAt: Date
  updatedAt: Date
}

class SettingsService {
  async getAllSettings(settings: string[]) {
    const prisma = getPrisma()
    const storageKeys = settings.map((setting) => toStorageSettingKey(setting))

    if (storageKeys.length === 0) {
      return []
    }

    const rows = await prisma.$queryRaw<SettingRow[]>(Prisma.sql`
      SELECT id, key, value, createdAt, updatedAt
      FROM Setting
      WHERE key IN (${Prisma.join(storageKeys)})
    `)

    return rows.map((row) => ({
      ...row,
      key: toPublicSettingKey(row.key)
    }))
  }

  async updateSetting(settings: SettingsUpdateDTO[]) {
    const prisma = getPrisma()

    for (const setting of settings) {
      const storageKey = toStorageSettingKey(setting.key)

      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO Setting (key, value, createdAt, updatedAt)
        VALUES (${storageKey}, ${setting.value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updatedAt = CURRENT_TIMESTAMP
      `)
    }

    return this.getAllSettings(settings.map((setting) => setting.key))
  }
}
export default SettingsService
