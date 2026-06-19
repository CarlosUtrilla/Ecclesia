import FontsService from './fonts.service'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'
import { RequestHandler } from '../../utils/RequestHandler'
import { notifyFontDeleted } from '../../config'
import { UsingMulter } from '../../decorators/multerDecorator'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export default class FontsController {
  private fontsService = new FontsService()

  async getSystemFonts() {
    return await this.fontsService.getSystemFonts()
  }

  @UpdateQueryKey(['fonts'])
  async addFont({ body }: RequestHandler<AddFontDTO>) {
    return await this.fontsService.addFont(body)
  }

  async getAllFonts() {
    return await this.fontsService.getAllFonts()
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 1 })
  @UpdateQueryKey(['fonts'])
  async uploadFont({ file }: RequestHandler<unknown, Express.Multer.File>) {
    if (!file) throw new Error('No se recibió el archivo de fuente')
    return await this.fontsService.uploadFont(file)
  }

  @UpdateQueryKey(['fonts'])
  async deleteFont({ body }: RequestHandler<DeleteFontDTO>) {
    const result = await this.fontsService.deleteFont(body)
    notifyFontDeleted()
    return result
  }
}
