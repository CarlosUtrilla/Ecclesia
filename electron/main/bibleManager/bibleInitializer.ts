import { getUserBiblesPath, listAvailableBibles } from './bibleManager'
import * as fs from 'fs'
import * as path from 'path'
import { BibleManagmentService } from '../../../database/controllers/bible/bibleManagment.service'

/**
 * Verifica si ya se ha inicializado el esquema de biblias
 */
function isBibleSchemaInitialized(): boolean {
  const markerPath = path.join(getUserBiblesPath(), '.schema-initialized')
  return fs.existsSync(markerPath)
}

/**
 * Marca que el esquema de biblias ya ha sido inicializado
 */
function markBibleSchemaAsInitialized(): void {
  const markerPath = path.join(getUserBiblesPath(), '.schema-initialized')
  fs.writeFileSync(markerPath, new Date().toISOString())
}

/**
 * Inicializa el esquema de biblias en la base de datos
 * Se ejecuta solo una vez en el primer arranque
 */
export async function initializeBibleSchema(): Promise<void> {
  try {
    // Verificar si ya se inicializó
    if (isBibleSchemaInitialized()) {
      console.log('ℹ️ Esquema de biblias ya inicializado, omitiendo...')
      return
    }

    // Verificar si hay biblias disponibles
    const bibles = listAvailableBibles()
    if (bibles.length === 0) {
      console.warn('⚠️ No hay biblias disponibles para generar esquema')
      return
    }

    console.log('📖 Inicializando esquema de biblias...')

    const bibleService = new BibleManagmentService()
    await bibleService.generateBibleSchema()
    await bibleService.checkInitialBibleSettings()

    // Marcar como inicializado
    markBibleSchemaAsInitialized()

    console.log('✅ Esquema de biblias inicializado correctamente')
  } catch (error) {
    console.error('❌ Error al inicializar esquema de biblias:', error)
    // No lanzamos el error para que no interrumpa el arranque de la app
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
