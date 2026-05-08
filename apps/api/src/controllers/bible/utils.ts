import Database from 'better-sqlite3'
import { getBiblesResourcesPath } from '../../prisma'

export async function openBible(version: string, absolutePath = false): Promise<Database.Database> {
  if (!version) {
    throw new Error('Version is required to open a Bible database.')
  }
  const biblesFolder = getBiblesResourcesPath()
  const biblePath = absolutePath ? version + '.ebbl' : `${biblesFolder}/${version}.ebbl`
  console.info('biblia folder', biblePath)
  const db = new Database(biblePath)
  return db
}
