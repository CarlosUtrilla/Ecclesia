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
      prisma.setting.update({
        where: {
          key: setting.key
        },
        data: {
          value: setting.value
        }
      })
    )
    return await prisma.$transaction(updatePromises)
  }
}
export default SettingsService
