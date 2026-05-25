import { BiblePresentationSettings } from '@prisma/client'
import { GetCompleteChapterDTO, GetVersesDTO, TextFragmentSearchDTO, ImportBibleResult } from './bible.dto'
import BibleService from './bible.service'
import { BibleManagmentService } from './bibleManagment.service'
import { RequestHandler } from '../../utils/RequestHandler'
import { UsingMulter } from '../../decorators/multerDecorator'
class BibleController {
  private BibleService = new BibleService()
  private BibleManagmentService = new BibleManagmentService()

  async getVerses({ body }: RequestHandler<GetVersesDTO>) {
    return this.BibleService.getVerses(body)
  }

  async getBibleSchema() {
    return this.BibleManagmentService.getBibleSchema()
  }

  async getCompleteChapter({ body }: RequestHandler<GetCompleteChapterDTO>) {
    return this.BibleService.getCompleteChapter(body)
  }
  async getAvailableBibles() {
    return this.BibleManagmentService.getAvalableBibles()
  }

  async searchTextFragment({ body }: RequestHandler<TextFragmentSearchDTO>) {
    return this.BibleService.searchTextFragment(body)
  }

  async getDefaultBibleSettings() {
    return this.BibleService.getDefaultBibleSettings()
  }

  async updateDefaultBibleSettings({ body }: RequestHandler<BiblePresentationSettings>) {
    return this.BibleService.updateDefaultBibleSettings(body)
  }

  @UsingMulter({ fieldName: 'file', maxFiles: 10 })
  async importBible({
    file,
    files
  }: RequestHandler<unknown, Express.Multer.File>): Promise<ImportBibleResult[]> {
    const targetFiles = file ? [file] : (files ?? [])
    return Promise.all(
      targetFiles.map((f) => this.BibleManagmentService.importBibleFile(f?.path, f?.originalname))
    )
  }
}

export default BibleController
