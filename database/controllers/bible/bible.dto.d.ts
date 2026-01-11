import { BibleSchema, BibleVerses } from '@prisma/client'

export type GetVersesDTO = {
  book: string
  chapter: number
  verses?: number[]
  version: string
}

export type BibleSchemaDTO = BibleSchema & {
  chapter: BibleVerses[]
}

export type BibleDTO = {
  id: number
  book: string
  book_id: string
  testament: 'Old' | 'New'
  chapter: number
  verse: number
  text: string
  text_normalized: string
}
