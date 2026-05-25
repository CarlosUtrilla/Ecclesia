import { getPrisma } from '../../prisma'
import { BibleSchemaDTO } from './bible.dto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { openBible } from './utils'
import { TestamentEnum } from '@prisma/client'
import { getBiblesResourcesPath } from '../../prisma'

const DIAG_LOG = path.join(os.tmpdir(), 'ecclesia-bible-diag.log')

const LOG = (msg: string) => {
  try { fs.appendFileSync(DIAG_LOG, `[${new Date().toISOString()}] [service] ${msg}\n`) } catch {}
  try { process.stderr.write(`[BIBLE-SERVICE] ${msg}\n`) } catch {}
}

const DEFAULT_BIBLE_EDGE_OFFSET = 10

export class BibleManagmentService {
  prisma = (() => { try { return getPrisma() } catch (e: any) { LOG(`getPrisma() THREW: ${e?.message || e}`); throw e } })()
  biblesFolder = (() => { try { return getBiblesResourcesPath() } catch (e: any) { LOG(`getBiblesResourcesPath() THREW: ${e?.message || e}`); throw e } })()
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
    LOG(`generateBibleSchema started, prisma=${typeof this.prisma}, biblesFolder=${this.biblesFolder}`)

    try {
      await this.prisma.bibleSchema.deleteMany({})
      LOG('deleteMany(bibleSchema) OK')
    } catch (e: any) {
      LOG(`deleteMany(bibleSchema) FAILED: ${e?.message || e}`)
      throw e
    }

    try {
      await this.prisma.bibleVerses.deleteMany({})
      LOG('deleteMany(bibleVerses) OK')
    } catch (e: any) {
      LOG(`deleteMany(bibleVerses) FAILED: ${e?.message || e}`)
      throw e
    }

    const existing = await this.prisma.bibleSchema.findFirst()
    if (existing) {
      LOG('bibleSchema already exists, skipping generation')
      return
    }

    LOG('opening RVR1960...')
    let db: any
    try {
      db = await openBible('RVR1960')
      LOG('openBible(RVR1960) OK')
    } catch (e: any) {
      LOG(`openBible(RVR1960) FAILED: ${e?.message || e}`)
      throw e
    }

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
    LOG(`getAvalableBibles: reading ${path}`)

    let files: string[]
    try {
      files = fs.readdirSync(path)
      LOG(`getAvalableBibles: readdir returned ${files.length} files: ${JSON.stringify(files)}`)
    } catch (e: any) {
      LOG(`getAvalableBibles: readdir FAILED: ${e?.message || e}`)
      return []
    }

    const availableBibles = files.filter((file: string) => file.endsWith('.ebbl'))
    LOG(`getAvalableBibles: found ${availableBibles.length} .ebbl files: ${JSON.stringify(availableBibles)}`)

    const bibles = await Promise.all(
      availableBibles.map(async (file) => {
        LOG(`getAvalableBibles: getting metadata for ${file}`)
        try {
          const meta = await this.getBibleMetadata(file, false)
          LOG(`getAvalableBibles: metadata for ${file}: ${JSON.stringify(meta)}`)
          return meta
        } catch (e: any) {
          LOG(`getAvalableBibles: metadata FAILED for ${file}: ${e?.message || e}`)
          return null
        }
      })
    )
    const filtered = bibles.filter(Boolean) as { name: string; language: string; version: string }[]
    LOG(`getAvalableBibles: returning ${filtered.length} bibles`)
    return filtered
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

  async getBibleMetadata(file: string, absolutePath = false) {
    const version = file.replace('.ebbl', '')
    const db = await openBible(version, absolutePath)

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
  }
}
