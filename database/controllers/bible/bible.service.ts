import type { BibleDTO, GetVersesDTO, TextFragmentSearchDTO } from './bible.dto'
import { getPrisma } from '../../../electron/main/prisma'
import { openBible } from './utils'

class BibleService {
  prisma = getPrisma()

  async getVerses({ book, chapter, verses, version }: GetVersesDTO) {
    const db = await openBible(version)

    try {
      if (!verses || verses.length === 0) {
        return []
      }

      // Caso: un solo versículo (más rápido)
      if (verses.length === 1) {
        const verse = db
          .prepare(
            `
          SELECT text
          FROM verses
          WHERE book = ?
            AND chapter = ?
            AND verse = ?
        `
          )
          .get(book, chapter, verses[0]) as BibleDTO | undefined
        console.log(verse)
        return verse ? [verse] : []
      }

      // Caso: múltiples versículos
      const placeholders = verses.map(() => '?').join(', ')

      const results = db
        .prepare(
          `
        SELECT text
        FROM verses
        WHERE book = ?
          AND chapter = ?
          AND verse IN (${placeholders})
        ORDER BY verse
      `
        )
        .all(book, chapter, ...verses) as BibleDTO[]
      console.log(results)
      return results
    } finally {
      db.close()
    }
  }

  async getCompleteChapter(version: string, book: string, chapter: number) {
    const db = await openBible(version)

    try {
      const results = db
        .prepare(
          `
            SELECT *
            FROM verses
            WHERE book_id = ?
              AND chapter = ?
            ORDER BY verse
          `
        )
        .all(book, chapter) as BibleDTO[]
      return results
    } finally {
      db.close()
    }
  }

  async searchTextFragment(params: TextFragmentSearchDTO) {
    const { text, version, book } = params
    const db = await openBible(version)

    try {
      let query = `
        SELECT *
        FROM verses
        WHERE text_normalized LIKE ?
      `
      const queryParams: (string | number)[] = [`%${text.toLowerCase()}%`]

      if (book) {
        query += ' AND book_id = ?'
        queryParams.push(book)
      }

      query += ' ORDER BY book_id, chapter, verse'

      const results = db.prepare(query).all(...queryParams) as BibleDTO[]
      return results
    } finally {
      db.close()
    }
  }

  async getBibleSettings() {
    const settings = await this.prisma.biblePresentationSettings.findFirst({
      where: { isGlobal: true }
    })
    return settings!
  }
}

export default BibleService
