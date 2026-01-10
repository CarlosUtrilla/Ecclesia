import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let prisma: PrismaClient | null = null

async function runMigrations(dbPath: string) {
  try {
    console.log('🔄 Ejecutando migraciones en la base de datos local...')

    // Establecer la variable de entorno para la URL de la base de datos
    const databaseUrl = `file:${dbPath}`

    // Determinar si estamos en desarrollo o producción
    const isDev = !app.isPackaged

    // Obtener rutas correctas según el entorno
    let prismaPath: string
    let migrationsPath: string

    if (isDev) {
      // En desarrollo
      prismaPath = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')
      migrationsPath = path.join(process.cwd(), 'prisma')
    } else {
      // En producción (app empaquetada)
      prismaPath = path.join(process.resourcesPath, 'node_modules', '.bin', 'prisma')
      migrationsPath = path.join(process.resourcesPath, 'prisma')

      // Verificar si existe, si no, usar rutas alternativas
      if (!fs.existsSync(prismaPath)) {
        prismaPath = path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          '.bin',
          'prisma'
        )
      }
      if (!fs.existsSync(migrationsPath)) {
        migrationsPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'prisma')
      }
    }

    const schemaPath = path.join(migrationsPath, 'schema.prisma')

    console.log('📁 Rutas de migración:')
    console.log('  - Prisma CLI:', prismaPath)
    console.log('  - Migraciones:', migrationsPath)
    console.log('  - Schema:', schemaPath)

    // Verificar que existen los archivos necesarios
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ No se encontró schema.prisma en:', schemaPath)
      return false
    }

    // Ejecutar prisma migrate deploy
    const command =
      process.platform === 'win32'
        ? `"${prismaPath}" migrate deploy --schema="${schemaPath}"`
        : `"${prismaPath}" migrate deploy --schema="${schemaPath}"`

    console.log('🚀 Ejecutando comando:', command)
    console.log('🎯 Base de datos destino:', databaseUrl)

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_SKIP_POSTINSTALL_GENERATE: '1'
      },
      cwd: migrationsPath
    })

    if (stdout) console.log('✅ Migraciones aplicadas:', stdout)
    if (stderr && !stderr.includes('Datasource')) console.error('⚠️ Advertencias:', stderr)

    return true
  } catch (error: any) {
    console.error('❌ Error al ejecutar migraciones:', error.message)
    if (error.stdout) console.log('stdout:', error.stdout)
    if (error.stderr) console.error('stderr:', error.stderr)
    // No lanzar error para que la app pueda continuar
    return false
  }
}

async function hasUserData(dbPath: string): Promise<boolean> {
  try {
    // Crear cliente temporal para verificar si hay datos
    const tempPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`
        }
      }
    })

    await tempPrisma.$connect()

    // Verificar si hay datos en tablas principales
    const [songsCount, themesCount, settingsCount] = await Promise.all([
      tempPrisma.songs.count(),
      tempPrisma.themes.count(),
      tempPrisma.settings.count()
    ])

    await tempPrisma.$disconnect()

    // Si hay datos personalizados del usuario, no eliminar
    return songsCount > 0 || themesCount > 0 || settingsCount > 0
  } catch (error) {
    console.error('Error verificando datos de usuario:', error)
    // En caso de error, asumir que hay datos para no eliminar
    return true
  }
}

async function initPrisma() {
  try {
    const userDataPath = app.getPath('userData')
    const destDbPath = path.join(userDataPath, 'dev.db')

    // Determinar ruta de la base de datos fuente según el entorno
    const isDev = !app.isPackaged
    const srcDbPath = isDev
      ? path.resolve(process.cwd(), 'prisma', 'dev.db')
      : path.join(process.resourcesPath, 'prisma', 'dev.db')

    // Copiar base solo si no existe
    const exists = await fs.pathExists(destDbPath)
    if (!exists) {
      console.log('📦 Copiando base de datos inicial...')
      if (await fs.pathExists(srcDbPath)) {
        await fs.copy(srcDbPath, destDbPath)
        console.log('✅ Base de datos copiada a userData:', destDbPath)
      } else {
        console.log('⚠️ No se encontró base de datos inicial, se creará una nueva')
      }
    } else {
      console.log('💾 Usando base de datos existente:', destDbPath)
    }

    // Siempre ejecutar migraciones para mantener la DB actualizada
    const migrationSuccess = await runMigrations(destDbPath)

    // Si las migraciones fallan y la DB existe
    if (!migrationSuccess && exists) {
      const hasData = await hasUserData(destDbPath)

      if (hasData) {
        // TIENE DATOS: NUNCA eliminar, mostrar error
        console.error(
          '❌ ERROR CRÍTICO: La base de datos no puede migrarse y contiene datos del usuario.'
        )
        console.error('   Las migraciones fallaron pero tus datos están seguros.')
        console.error('   La aplicación continuará con la versión actual de la base de datos.')
        console.warn('⚠️  IMPORTANTE: Algunas funciones nuevas pueden no estar disponibles.')
        // NO lanzar error, permitir que la app continúe con la DB actual
      } else {
        // SIN DATOS: seguro eliminar y recrear
        console.log('🔄 Recreando base de datos desde cero (sin datos de usuario)...')
        await fs.remove(destDbPath)
        if (await fs.pathExists(srcDbPath)) {
          await fs.copy(srcDbPath, destDbPath)
          await runMigrations(destDbPath)
        }
      }
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${destDbPath}`
        }
      }
    })

    await prisma.$connect()
    console.log('✅ Prisma conectado a la base de datos')
    return prisma
  } catch (error) {
    console.error('❌ Error al inicializar Prisma:', error)
    throw error
  }
}

function getPrisma() {
  if (!prisma) {
    throw new Error('Prisma no ha sido inicializado. Llama primero a initPrisma()')
  }
  return prisma
}

export { initPrisma, getPrisma }
