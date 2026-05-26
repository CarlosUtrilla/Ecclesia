import { RequestHandler } from '../../utils/RequestHandler'
import { SettingsUpdateDTO } from './settings.dto'
import SettingsService from './settings.service'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

class SettingsController {
  private SettingsService = new SettingsService()

  async getSettings({ body }: RequestHandler<{ settings: string[] }>) {
    return await this.SettingsService.getAllSettings(body.settings)
  }

  @UpdateQueryKey(['settings'])
  async updateSettings({ body }: RequestHandler<{ settings: SettingsUpdateDTO[] }>) {
    return await this.SettingsService.updateSetting(body.settings)
  }
}

// Exportas directamente una instancia
export default SettingsController
