import { WithRole } from '../../decorators/withRole'
import { SettingsUpdateDTO } from './settings.dto'
import SettingsService from './settings.service'
import { SettingOptions } from '@prisma/client'

class SettingsController {
  private SettingsService = new SettingsService()

  @WithRole('owner', 'admin', 'manager')
  async getSettings(settings: SettingOptions[]) {
    return await this.SettingsService.getAllSettings(settings)
  }

  @WithRole('owner', 'admin', 'manager')
  async updateSettings(settings: SettingsUpdateDTO[]) {
    return await this.SettingsService.updateSetting(settings)
  }
}

// Exportas directamente una instancia
export default SettingsController
