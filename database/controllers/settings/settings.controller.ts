import { SettingsUpdateDTO } from './settings.dto'
import SettingsService from './settings.service'
import { SettingOptions } from '@prisma/client'

class SettingsController {
  private SettingsService = new SettingsService()

  async getSettings(settings: SettingOptions[]) {
    return await this.SettingsService.getAllSettings(settings)
  }

  async updateSettings(settings: SettingsUpdateDTO[]) {
    return await this.SettingsService.updateSetting(settings)
  }
}

// Exportas directamente una instancia
export default SettingsController
