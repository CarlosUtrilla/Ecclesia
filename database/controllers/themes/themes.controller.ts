import { ThemesService } from './themes.service'

export class ThemesController {
  private themesService: ThemesService

  constructor() {
    this.themesService = new ThemesService()
  }

  createTheme = async (data: any) => {
    return await this.themesService.createTheme(data)
  }

  getAllThemes = async () => {
    return await this.themesService.getAllThemes()
  }

  getThemeById = async (id: number) => {
    return await this.themesService.getThemeById(id)
  }

  getThemeByName = async (name: string) => {
    return await this.themesService.getThemeByName(name)
  }

  updateTheme = async (id: number, data: any) => {
    return await this.themesService.updateTheme(id, data)
  }

  deleteTheme = async (id: number) => {
    return await this.themesService.deleteTheme(id)
  }
}
