import { getPrisma } from '../../prisma'
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

    const result = await this.getAllSettings(settings.map((setting) => setting.key))

    // El write usa $executeRaw (el `key` es un enum y así se evita su validación),
    // pero eso NO pasa por el middleware oplog, así que los settings no se
    // sincronizaban a Drive. Registramos el evento manualmente por cada setting.
    try {
      const { oplogService } = await import('../sync-oplog/oplog.service')
      for (const row of result) {
        await oplogService.appendEvent({
          entityType: 'setting',
          entityId: String(row.id),
          op: 'upsert',
          data: { id: row.id, key: toStorageSettingKey(row.key), value: row.value }
        })
      }
    } catch {
      // Si el oplog no está inicializado, no bloquear el guardado local.
    }

    return result
  }
}
export default SettingsService
