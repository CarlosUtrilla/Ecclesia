import FontsService from './fonts.service'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'
import { RequestHandler } from '../../utils/RequestHandler'
import { notifyFontDeleted } from '../../config'

export default class FontsController {
  private fontsService = new FontsService()

  async addFont({ body }: RequestHandler<AddFontDTO>) {
    return await this.fontsService.addFont(body)
  }

  async getAllFonts() {
    return await this.fontsService.getAllFonts()
  }

  async deleteFont({ body }: RequestHandler<DeleteFontDTO>) {
    const result = await this.fontsService.deleteFont(body)
    notifyFontDeleted()
    return result
  }
}
