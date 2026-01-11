import Database from 'better-sqlite3'
import type { BibleDTO, GetVersesDTO } from './bible.dto'
import { getBiblesResourcesPath } from '../../../electron/main/bibleManager'
import { getPrisma } from '../../../electron/main/prisma'

class BibleService {
  prisma = getPrisma()
  biblesFolder = getBiblesResourcesPath()

  async openBible(version: string): Promise<Database.Database> {
    const biblePath = `${this.biblesFolder}/${version}.ebbl`
    const db = new Database(biblePath)
    return db
  }
  async getVerses({ book, chapter, verses, version }: GetVersesDTO) {
    const db = await this.openBible(version)

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

  async generateBibleSchema() {
    // Comprobar si el schema ya existe
    const existing = await this.prisma.bibleSchema.findFirst()
    if (existing) {
      console.log('ℹ️ Esquema de biblia ya existe, omitiendo generación')
      return
    }

    // Usar una biblia por defecto para generar el esquema
    const db = await this.openBible('RVR1960')

    const rows = db
      .prepare(
        `
    SELECT
      book,
      chapter,
      MAX(verse) AS verses
    FROM verses
    GROUP BY book, chapter
    ORDER BY id
  `
      )
      .all() as {
      book: string
      chapter: number
      verses: number
    }[]

    db.close()

    const map = [] as {
      book: string
      chapter: {
        chapter: number
        verses: number
      }[]
    }[]

    rows.forEach((row) => {
      let bookEntry = map.find((b) => b.book === row.book)
      if (!bookEntry) {
        bookEntry = {
          book: row.book,
          chapter: []
        }
        map.push(bookEntry)
      }
      bookEntry.chapter.push({
        chapter: row.chapter,
        verses: row.verses
      })
    })

    // Crear cada libro con sus capítulos
    for (const bookData of map) {
      await this.prisma.bibleSchema.create({
        data: {
          book: bookData.book,
          chapter: {
            create: bookData.chapter.map((ch) => ({
              chapter: ch.chapter,
              verses: ch.verses
            }))
          }
        }
      })
    }

    console.log('✅ Esquema de biblia generado correctamente')
  }

  getBibleSchema() {
    return this.prisma.bibleSchema.findMany({
      include: {
        chapter: true
      },
      orderBy: {
        id: 'asc'
      }
    })
  }
}

export default BibleService
