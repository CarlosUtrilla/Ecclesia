import Database from 'better-sqlite3'
import { getBiblesResourcesPath } from '../../../electron/main/bibleManager/bibleManager'

export async function openBible(version: string): Promise<Database.Database> {
  const biblesFolder = getBiblesResourcesPath()
  const biblePath = `${biblesFolder}/${version}.ebbl`
  const db = new Database(biblePath)
  return db
}
