import {
  StageScreenConfigFilterDTO,
  UpsertStageScreenConfigDTO,
  UpdateStageScreenLayoutDTO,
  UpdateStageScreenStateDTO,
  UpdateStageScreenThemeDTO
} from './stageScreenConfig.dto'
import StageScreenConfigService from './stageScreenConfig.service'

class StageScreenConfigController {
  private stageScreenConfigService = new StageScreenConfigService()

  async getAllStageScreenConfigs(filter?: StageScreenConfigFilterDTO) {
    return await this.stageScreenConfigService.getAllStageScreenConfigs(filter)
  }

  async getStageScreenConfigById(id: number) {
    return await this.stageScreenConfigService.getStageScreenConfigById(id)
  }

  async getStageScreenConfigBySelectedScreenId(selectedScreenId: number) {
    return await this.stageScreenConfigService.getStageScreenConfigBySelectedScreenId(
      selectedScreenId
    )
  }

  async upsertStageScreenConfig(data: UpsertStageScreenConfigDTO) {
    return await this.stageScreenConfigService.upsertStageScreenConfig(data)
  }

  async updateStageScreenTheme(data: UpdateStageScreenThemeDTO) {
    return await this.stageScreenConfigService.updateStageScreenTheme(data)
  }

  async updateStageScreenLayout(data: UpdateStageScreenLayoutDTO) {
    return await this.stageScreenConfigService.updateStageScreenLayout(data)
  }

  async updateStageScreenState(data: UpdateStageScreenStateDTO) {
    return await this.stageScreenConfigService.updateStageScreenState(data)
  }

  async deleteStageScreenConfigBySelectedScreenId(selectedScreenId: number) {
    return await this.stageScreenConfigService.deleteStageScreenConfigBySelectedScreenId(
      selectedScreenId
    )
  }
}

export default StageScreenConfigController
