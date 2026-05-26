import FontsService from './fonts.service'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'
import { RequestHandler } from '../../utils/RequestHandler'
import { notifyFontDeleted } from '../../config'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export default class FontsController {
  private fontsService = new FontsService()

  @UpdateQueryKey(['fonts'])
  async addFont({ body }: RequestHandler<AddFontDTO>) {
    return await this.fontsService.addFont(body)
  }

  async getAllFonts() {
    return await this.fontsService.getAllFonts()
  }

  @UpdateQueryKey(['fonts'])
  async deleteFont({ body }: RequestHandler<DeleteFontDTO>) {
    const result = await this.fontsService.deleteFont(body)
    notifyFontDeleted()
    return result
  }
}
