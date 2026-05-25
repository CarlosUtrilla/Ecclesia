import { getUserBiblesPath, listAvailableBibles } from './bibleManager'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BibleManagmentService } from '@ecclesia/api/src/controllers/bible/bibleManagment.service'

const DIAG_LOG = path.join(os.tmpdir(), 'ecclesia-bible-diag.log')

const LOG = (msg: string) => {
  try { fs.appendFileSync(DIAG_LOG, `[${new Date().toISOString()}] [BIBLE] ${msg}\n`) } catch {}
  try { process.stderr.write(`[BIBLE] ${msg}\n`) } catch {}
}

/**
 * Verifica si ya se ha inicializado el esquema de biblias
 */
function isBibleSchemaInitialized(): boolean {
  const markerPath = path.join(getUserBiblesPath(), '.schema-initialized')
  LOG(`markerPath=${markerPath} exists=${fs.existsSync(markerPath)}`)
  return fs.existsSync(markerPath)
}

/**
 * Marca que el esquema de biblias ya ha sido inicializado
 */
function markBibleSchemaAsInitialized(): void {
  const markerPath = path.join(getUserBiblesPath(), '.schema-initialized')
  fs.writeFileSync(markerPath, new Date().toISOString())
  LOG(`marker written: ${markerPath}`)
}

/**
 * Inicializa el esquema de biblias en la base de datos
 * Se ejecuta solo una vez en el primer arranque
 */
export async function initializeBibleSchema(): Promise<void> {
  try {
    LOG('initializeBibleSchema started')
    if (isBibleSchemaInitialized()) {
      LOG('already initialized, skipping')
      return
    }

    const bibles = listAvailableBibles()
    LOG(`listAvailableBibles returned ${bibles.length} bibles: ${JSON.stringify(bibles)}`)

    if (bibles.length === 0) {
      LOG('no bibles available, skipping')
      return
    }

    LOG('creating BibleManagmentService...')
    const bibleService = new BibleManagmentService()
    LOG('calling generateBibleSchema...')
    await bibleService.generateBibleSchema()
    LOG('calling checkInitialBibleSettings...')
    await bibleService.checkInitialBibleSettings()
    markBibleSchemaAsInitialized()
    LOG('schema initialized successfully')
  } catch (error) {
    LOG(`ERROR: ${error instanceof Error ? error.stack : String(error)}`)
  }
}

/**
 * Reinicializa el esquema de biblias (útil para actualizaciones)
 */
export async function reinitializeBibleSchema(): Promise<void> {
  const markerPath = path.join(getUserBiblesPath(), '.schema-initialized')

  // Eliminar el marcador
  if (fs.existsSync(markerPath)) {
    fs.unlinkSync(markerPath)
  }

  // Reinicializar
  await initializeBibleSchema()
}
