import { getPrisma } from '../../../electron/main/prisma'
import { BibleSchemaDTO } from './bible.dto'
import * as fs from 'fs'
import { openBible } from './utils'
import { TestamentEnum } from '@prisma/client'
import { getBiblesResourcesPath } from '../../../electron/main/bibleManager/bibleManager'

const DEFAULT_BIBLE_EDGE_OFFSET = 10

export class BibleManagmentService {
  prisma = getPrisma()
  biblesFolder = getBiblesResourcesPath()
  async checkInitialBibleSettings() {
    const existsDefault = await this.prisma.biblePresentationSettings.findFirst({
      where: { isGlobal: true }
    })
    if (!existsDefault) {
      await this.prisma.biblePresentationSettings.create({
        data: {
          isGlobal: true,
          position: 'overText',
          showVersion: true,
          showVerseNumber: false,
          positionStyle: DEFAULT_BIBLE_EDGE_OFFSET
        }
      })
      console.log('✅ Configuración inicial de presentación de biblias creada')
    } else {
      if (existsDefault.positionStyle === null || existsDefault.positionStyle === undefined) {
        await this.prisma.biblePresentationSettings.update({
          where: { id: existsDefault.id },
          data: { positionStyle: DEFAULT_BIBLE_EDGE_OFFSET }
        })
        console.log('ℹ️ Configuración global de biblia normalizada con separación inicial de 10px')
      }

      console.log('ℹ️ Configuración inicial de presentación de biblias ya existe')
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
    const db = await openBible('RVR1960')

    const rows = db
      .prepare(
        `
      SELECT
        book,
        chapter,
        book_short,
        book_id,
        testament,
        MAX(verse) AS verses
      FROM verses
      GROUP BY book, chapter
      ORDER BY id
    `
      )
      .all() as {
      book: string
      book_short: string
      book_id: number
      chapter: number
      verses: number
      testament: TestamentEnum
    }[]

    db.close()

    const map = [] as {
      book: string
      book_id: number
      book_short: string
      testament: TestamentEnum
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
          book_short: row.book_short,
          testament: row.testament,
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
          testament: bookData.testament,
          book_short: bookData.book_short,
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
        const db = await openBible(version)

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
