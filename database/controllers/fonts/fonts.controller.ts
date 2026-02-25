import FontsService from './fonts.service'
import { AddFontDTO, DeleteFontDTO } from './fonts.dto.d.ts'

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
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((win: any) => {
        win.webContents.send('font-deleted')
      })
    } catch {}
    return result
  }
}
