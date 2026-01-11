import Database from 'better-sqlite3'
import type { BibleDTO, BibleSchemaDTO, GetVersesDTO } from './bible.dto'
import { getBiblesResourcesPath } from '../../../electron/main/bibleManager'
import { getPrisma } from '../../../electron/main/prisma'
import fs from 'fs'

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

  async getCompleteChapter(version: string, book: string, chapter: number) {
    const db = await this.openBible(version)

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

  async generateBibleSchema() {
    // Comprobar si el schema ya existe
    await this.prisma.bibleSchema.deleteMany({})
    await this.prisma.bibleVerses.deleteMany({})
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
      book_id,
      MAX(verse) AS verses
    FROM verses
    GROUP BY book, chapter
    ORDER BY id
  `
      )
      .all() as {
      book: string
      book_id: string
      chapter: number
      verses: number
    }[]

    db.close()

    const map = [] as {
      book: string
      book_id: string
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
          book_id: row.book_id,
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
          book_id: bookData.book_id,
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

  async getAvalableBibles() {
    const path = this.biblesFolder

    const files = fs.readdirSync(path)
    const availableBibles = files.filter((file: string) => file.endsWith('.ebbl'))
    // conectarse a la bd de casa biblia y obtener su nombre
    const bibles = await Promise.all(
      availableBibles.map(async (file: string) => {
        const version = file.replace('.ebbl', '')
        const db = await this.openBible(version)

        // obtener name, language y version de la biblia
        const info = db
          .prepare(
            `
              SELECT value, key
              FROM meta
              WHERE key in ('name', 'language')
            `
          )
          .all() as { value: string; key: string }[] | undefined
        db.close()
        const obj = Object.fromEntries(info!.map((i) => [i.key, i.value]))
        obj.version = version
        return obj as { name: string; language: string; version: string }
      })
    )
    return bibles
  }

  getBibleSchema(): Promise<BibleSchemaDTO[]> {
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
