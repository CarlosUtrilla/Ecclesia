import { RequestHandler } from '../../utils/RequestHandler'
import {
  StageScreenConfigFilterDTO,
  UpsertStageScreenConfigDTO,
  UpdateStageScreenLayoutDTO,
  UpdateStageScreenStateDTO,
  UpdateStageScreenThemeDTO
} from './stageScreenConfig.dto'
import StageScreenConfigService from './stageScreenConfig.service'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

class StageScreenConfigController {
  private stageScreenConfigService = new StageScreenConfigService()

  async getAllStageScreenConfigs({ body }: RequestHandler<StageScreenConfigFilterDTO | undefined>) {
    return await this.stageScreenConfigService.getAllStageScreenConfigs(body)
  }

  async getStageScreenConfigById({ body }: RequestHandler<{ id: number }>) {
    return await this.stageScreenConfigService.getStageScreenConfigById(body.id)
  }

  async getStageScreenConfigBySelectedScreenId({
    body
  }: RequestHandler<{ selectedScreenId: number }>) {
    return await this.stageScreenConfigService.getStageScreenConfigBySelectedScreenId(
      body.selectedScreenId
    )
  }

  @UpdateQueryKey(['stageScreenConfig'])
  async upsertStageScreenConfig({ body }: RequestHandler<UpsertStageScreenConfigDTO>) {
    return await this.stageScreenConfigService.upsertStageScreenConfig(body)
  }

  @UpdateQueryKey(['stageScreenConfig'])
  async updateStageScreenTheme({ body }: RequestHandler<UpdateStageScreenThemeDTO>) {
    return await this.stageScreenConfigService.updateStageScreenTheme(body)
  }

  @UpdateQueryKey(['stageScreenConfig'])
  async updateStageScreenLayout({ body }: RequestHandler<UpdateStageScreenLayoutDTO>) {
    return await this.stageScreenConfigService.updateStageScreenLayout(body)
  }

  @UpdateQueryKey(['stageScreenConfig'])
  async updateStageScreenState({ body }: RequestHandler<UpdateStageScreenStateDTO>) {
    return await this.stageScreenConfigService.updateStageScreenState(body)
  }

  async deleteStageScreenConfigBySelectedScreenId({
    body
  }: RequestHandler<{ selectedScreenId: number }>) {
    return await this.stageScreenConfigService.deleteStageScreenConfigBySelectedScreenId(
      body.selectedScreenId
    )
  }
}

export default StageScreenConfigController
