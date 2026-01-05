import { getPrisma } from '../../../electron/main/prisma'
import { SettingOptions } from '@prisma/client'
import { SettingsUpdateDTO } from './settings.dto'
class SettingsService {
  private prisma = getPrisma()

  async getAllSettings(settings: SettingOptions[]) {
    return await this.prisma.setting.findMany({
      where: {
        key: {
          in: settings
        }
      }
    })
  }

  async updateSetting(settings: SettingsUpdateDTO[]) {
    const updatePromises = settings.map((setting) =>
      this.prisma.setting.update({
        where: {
          key: setting.key
        },
        data: {
          value: setting.value
        }
      })
    )
    return await this.prisma.$transaction(updatePromises)
  }
}
export default SettingsService
