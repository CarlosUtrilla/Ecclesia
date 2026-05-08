import FontsService from './fonts.service'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'
import { BrowserWindow } from 'electron'
import { RequestHandler } from '../../utils/RequestHandler'

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
    // Emitir evento a todas las ventanas
    try {
      BrowserWindow.getAllWindows().forEach((win: any) => {
        win.webContents.send('font-deleted')
      })
    } catch (e) {
      console.error('Error al emitir evento de font-deleted:', e)
    }
    return result
  }
}
