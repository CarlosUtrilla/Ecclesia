import { GetVersesDTO } from './bible.dto'
import BibleService from './bible.service'

class BibleController {
  private BibleService = new BibleService()

  async getVerses(params: GetVersesDTO) {
    return this.BibleService.getVerses(params)
  }

  async getBibleSchema() {
    return this.BibleService.getBibleSchema()
  }
}

// Exportar clase
export default BibleController
