import FontsService from './fonts.service'
import type { AddFontDTO, DeleteFontDTO } from './fonts.dto'
import { BrowserWindow } from 'electron'

export default class FontsController {
  private fontsService = new FontsService()

  async addFont(data: AddFontDTO) {
    return await this.fontsService.addFont(data)
  }

  async getAllFonts() {
    return await this.fontsService.getAllFonts()
  }

  async deleteFont(data: DeleteFontDTO) {
    const result = await this.fontsService.deleteFont(data)
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
