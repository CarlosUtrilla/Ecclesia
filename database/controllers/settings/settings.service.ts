import { getPrisma } from '../../../electron/main/prisma'
import { SettingOptions } from '@prisma/client'
import { SettingsUpdateDTO } from './settings.dto'
class SettingsService {
  async getAllSettings(settings: SettingOptions[]) {
    const prisma = getPrisma()
    return await prisma.setting.findMany({
      where: {
        key: {
          in: settings
        }
      }
    })
  }

  async updateSetting(settings: SettingsUpdateDTO[]) {
    const prisma = getPrisma()
    const updatePromises = settings.map((setting) =>
      prisma.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value }
      })
    )
    return await prisma.$transaction(updatePromises)
  }
}
export default SettingsService
