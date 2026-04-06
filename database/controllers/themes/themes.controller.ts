import { ThemesService } from './themes.service'
import { CreateThemeDto, UpdateThemeDto } from './themes.dto'

export class ThemesController {
  private themesService: ThemesService

  constructor() {
    this.themesService = new ThemesService()
  }

  async createTheme(data: CreateThemeDto) {
    return await this.themesService.createTheme(data)
  }

  async getAllThemes() {
    return await this.themesService.getAllThemes()
  }

  async getThemeById(id: number) {
    return await this.themesService.getThemeById(id)
  }

  async getThemeByName(name: string) {
    return await this.themesService.getThemeByName(name)
  }

  async updateTheme(id: number, data: UpdateThemeDto) {
    return await this.themesService.updateTheme(id, data)
  }

  async deleteTheme(id: number) {
    return await this.themesService.deleteTheme(id)
  }

  async exportThemeToZip(id: number) {
    return await this.themesService.exportThemeToZip(id)
  }

  async importThemeFromZip(zipPath: string) {
    return await this.themesService.importThemeFromZip(zipPath)
  }
}
