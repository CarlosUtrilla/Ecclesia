import { GetVersesDTO, TextFragmentSearchDTO } from './bible.dto'
import BibleService from './bible.service'
import { BibleManagmentService } from './bibleManagment.service'
class BibleController {
  private BibleService = new BibleService()
  private BibleManagmentService = new BibleManagmentService()

  async getVerses(params: GetVersesDTO) {
    return this.BibleService.getVerses(params)
  }

  async getBibleSchema() {
    return this.BibleManagmentService.getBibleSchema()
  }

  async getCompleteChapter(version: string, book: string, chapter: number) {
    return this.BibleService.getCompleteChapter(version, book, chapter)
  }
  async getAvailableBibles() {
    return this.BibleManagmentService.getAvalableBibles()
  }

  async searchTextFragment(params: TextFragmentSearchDTO) {
    return this.BibleService.searchTextFragment(params)
  }

  async getDefaultBibleSettings() {
    return this.BibleService.getDefaultBibleSettings()
  }
}

// Exportar clase
export default BibleController
