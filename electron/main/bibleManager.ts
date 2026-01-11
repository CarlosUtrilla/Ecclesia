import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Obtiene la ruta a la carpeta de biblias en recursos
 * Funciona tanto en desarrollo como en producción
 */
export function getBiblesResourcesPath(): string {
  if (app.isPackaged) {
    // En producción: los recursos están en resources/bibles dentro del bundle
    return path.join(process.resourcesPath, 'bibles')
  } else {
    // En desarrollo: los recursos están en la carpeta del proyecto
    return path.join(__dirname, '../../resources/bibles')
  }
}

/**
 * Obtiene la ruta a la carpeta de biblias del usuario
 */
export function getUserBiblesPath(): string {
  return path.join(app.getPath('userData'), 'bibles')
}

/**
 * Copia un archivo de biblia si no existe en el destino
 */
function copyBibleIfNotExists(sourceFile: string, targetFile: string): void {
  if (!fs.existsSync(targetFile)) {
    fs.copyFileSync(sourceFile, targetFile)
    console.log(`📖 Biblia copiada: ${path.basename(sourceFile)}`)
  }
}

/**
 * Inicializa las biblias por defecto en la carpeta del usuario
 * Solo copia las biblias que no existen
 */
export function initializeDefaultBibles(): void {
  console.log('📚 Inicializando biblias por defecto...')

  const sourcePath = getBiblesResourcesPath()
  const targetPath = getUserBiblesPath()

  // Crear carpeta de biblias si no existe
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true })
  }

  // Verificar si existe la carpeta de recursos
  if (!fs.existsSync(sourcePath)) {
    console.warn('⚠️ No se encontró la carpeta de biblias en recursos')
    return
  }

  try {
    // Obtener todos los archivos .ebbl de la carpeta de recursos
    const files = fs.readdirSync(sourcePath)
    const bibleFiles = files.filter((file) => file.endsWith('.ebbl'))

    if (bibleFiles.length === 0) {
      console.warn('⚠️ No hay biblias .ebbl en la carpeta de recursos')
      return
    }

    // Copiar cada biblia si no existe
    bibleFiles.forEach((file) => {
      const sourceFile = path.join(sourcePath, file)
      const targetFile = path.join(targetPath, file)
      copyBibleIfNotExists(sourceFile, targetFile)
    })

    console.log(`✅ Biblias inicializadas en: ${targetPath}`)
  } catch (error) {
    console.error('❌ Error al copiar biblias:', error)
  }
}

/**
 * Lista todas las biblias disponibles en la carpeta del usuario
 */
export function listAvailableBibles(): string[] {
  const biblesPath = getUserBiblesPath()

  if (!fs.existsSync(biblesPath)) {
    return []
  }

  try {
    const files = fs.readdirSync(biblesPath)
    return files.filter((file) => file.endsWith('.ebbl'))
  } catch (error) {
    console.error('Error al listar biblias:', error)
    return []
  }
}

/**
 * Obtiene la ruta completa a un archivo de biblia
 */
export function getBiblePath(filename: string): string {
  // Asegurar que tenga la extensión .ebbl
  const bibleFilename = filename.endsWith('.ebbl') ? filename : `${filename}.ebbl`
  const biblePath = path.join(getUserBiblesPath(), bibleFilename)

  if (!fs.existsSync(biblePath)) {
    throw new Error(`Biblia no encontrada: ${bibleFilename}`)
  }

  return biblePath
}

/**
 * Elimina una biblia
 */
export function deleteBible(filename: string): void {
  const biblePath = path.join(getUserBiblesPath(), filename)

  if (!fs.existsSync(biblePath)) {
    throw new Error(`Biblia no encontrada: ${filename}`)
  }

  try {
    fs.unlinkSync(biblePath)
    console.log(`🗑️ Biblia eliminada: ${filename}`)
  } catch (error) {
    console.error('Error al eliminar biblia:', error)
    throw error
  }
}

/**
 * Importa una biblia desde una ruta externa
 */
export function importBible(sourcePath: string, newFilename?: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Archivo no encontrado')
  }

  // Validar que sea un archivo .ebbl
  if (!sourcePath.endsWith('.ebbl')) {
    throw new Error('El archivo debe tener extensión .ebbl')
  }

  let filename = newFilename || path.basename(sourcePath)

  // Asegurar que tenga la extensión .ebbl
  if (!filename.endsWith('.ebbl')) {
    filename = `${filename}.ebbl`
  }

  const targetPath = path.join(getUserBiblesPath(), filename)

  // Si ya existe, añadir un sufijo
  let finalPath = targetPath
  let counter = 1
  while (fs.existsSync(finalPath)) {
    const nameWithoutExt = filename.replace('.ebbl', '')
    finalPath = path.join(getUserBiblesPath(), `${nameWithoutExt}-${counter}.ebbl`)
    counter++
  }

  fs.copyFileSync(sourcePath, finalPath)
  console.log(`📥 Biblia importada: ${path.basename(finalPath)}`)

  return path.basename(finalPath)
}
