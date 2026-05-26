import { ThemesService } from './themes.service'
import { CreateThemeDto, UpdateThemeDto } from './themes.dto'
import { RequestHandler } from '../../utils/RequestHandler'
import { UsingMulter } from '../../decorators/multerDecorator'
import { UpdateQueryKey } from '../../decorators/UpdateQueryKey.decorator'

export class ThemesController {
  private themesService: ThemesService

  constructor() {
    this.themesService = new ThemesService()
  }

  @UpdateQueryKey(['themes'])
  async createTheme({ body }: RequestHandler<CreateThemeDto>) {
    return await this.themesService.createTheme(body)
  }

  async getAllThemes() {
    return await this.themesService.getAllThemes()
  }

  async getThemeById({ body }: RequestHandler<{ id: number }>) {
    return await this.themesService.getThemeById(body.id)
  }

  async getThemeByName({ body }: RequestHandler<{ name: string }>) {
    return await this.themesService.getThemeByName(body.name)
  }

  @UpdateQueryKey(['themes'])
  async updateTheme({ body }: RequestHandler<{ id: number } & UpdateThemeDto>) {
    return await this.themesService.updateTheme(body.id, body)
  }

  @UpdateQueryKey(['themes'])
  async deleteTheme({ body }: RequestHandler<{ id: number }>) {
    return await this.themesService.deleteTheme(body.id)
  }

  async exportThemeToZip({ body }: RequestHandler<{ id: number }>) {
    return await this.themesService.exportThemeToZip(body.id)
  }

  @UpdateQueryKey(['themes'])
  async importThemeFromZip({ body }: RequestHandler<{ zipPath: string }>) {
    return await this.themesService.importThemeFromZip(body.zipPath)
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 10 })
  @UpdateQueryKey(['themes'])
  async importThemeZip({
    file,
    files
  }: RequestHandler<unknown, Express.Multer.File>) {
    const targetFiles = file ? [file] : (files ?? [])
    const results = await Promise.all(
      targetFiles.map((f) => this.themesService.importThemeFromZip(f.path))
    )
    return results
  }
}
