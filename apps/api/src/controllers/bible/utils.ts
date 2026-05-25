import * as path from 'path'
import * as os from 'os'
import type Database from 'better-sqlite3'
import { getBiblesResourcesPath } from '../../prisma'

let DatabaseConstructor: typeof Database | null = null

const DIAG_LOG = path.join(os.tmpdir(), 'ecclesia-bible-diag.log')

const LOG = (msg: string) => {
  try { require('fs').appendFileSync(DIAG_LOG, `[${new Date().toISOString()}] [utils] ${msg}\n`) } catch {}
  try { process.stderr.write(`[BIBLE-UTILS] ${msg}\n`) } catch {}
}

function getDatabase(): typeof Database {
  if (!DatabaseConstructor) {
    LOG('loading better-sqlite3...')
    try {
      DatabaseConstructor = require('better-sqlite3')
      LOG('better-sqlite3 loaded OK')
    } catch (e: any) {
      LOG(`better-sqlite3 FAILED to load: ${e?.message || e}`)
      throw e
    }
  }
  return DatabaseConstructor!
}

export async function openBible(version: string, absolutePath = false) {
  if (!version) {
    throw new Error('Version is required to open a Bible database.')
  }
  const biblesFolder = getBiblesResourcesPath()
  const biblePath = absolutePath ? version + '.ebbl' : path.join(biblesFolder, `${version}.ebbl`)
  LOG(`openBible: trying ${biblePath}`)
  console.info('biblia folder', biblePath)
  const db = getDatabase()(biblePath, { readonly: true })
  LOG(`openBible: opened OK`)
  return db
}

export async function openBiblePath(filePath: string) {
  LOG(`openBiblePath: trying ${filePath}`)
  console.info('biblia direct path', filePath)
  const db = getDatabase()(filePath, { readonly: true })
  LOG(`openBiblePath: opened OK`)
  return db
}
