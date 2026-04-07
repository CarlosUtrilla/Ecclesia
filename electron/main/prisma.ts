import { PrismaClient, SyncOperation } from '@prisma/client'
import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { AsyncLocalStorage } from 'async_hooks'
import log from 'electron-log'
import { serializeOutboxPayload } from './sync/outboxPayload'

const execAsync = promisify(exec)
let prisma: PrismaClient | null = null
const outboxContext = new AsyncLocalStorage<{ skipOutbox: boolean }>()
const PACKAGED_DB_TEMPLATE_NAME = 'empty-prod.db'

function getTemplateDbPath(isDev: boolean): string {
  return isDev
    ? path.resolve(process.cwd(), 'prisma', PACKAGED_DB_TEMPLATE_NAME)
    : path.join(process.resourcesPath, 'prisma', PACKAGED_DB_TEMPLATE_NAME)
}

const SYNC_CONFIG_DIR_NAME = 'sync'
const SYNC_CONFIG_FILE_NAME = 'google-drive-config.json'
const OUTBOX_CACHE_TTL_MS = 5000
const OUTBOX_TRACKED_ACTIONS = new Set([
  'create',
  'update',
  'upsert',
  'delete',
  'deleteMany',
  'updateMany',
  'createMany',
  'createManyAndReturn'
])
const OUTBOX_EXCLUDED_MODELS = new Set(['SyncOutboxChange', 'SyncInboxChange', 'SyncState'])

let onOutboxWriteCallback: (() => void) | null = null
let onMediaChangeCallback: (() => void) | null = null

export function setOnOutboxWriteCallback(fn: () => void): void {
  onOutboxWriteCallback = fn
}

export function setOnMediaChangeCallback(fn: () => void): void {
  onMediaChangeCallback = fn
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!(await fs.pathExists(filePath))) return null
    return (await fs.readJSON(filePath)) as T
  } catch {
    return null
  }
}

type SyncIdentity = {
  workspaceId: string
  deviceId: string
}

type SyncConfigSnapshot = {
  enabled?: boolean
  workspaceId?: string
  deviceName?: string
}

type CachedSyncIdentity = {
  loadedAt: number
  value: SyncIdentity | null
}

let cachedSyncIdentity: CachedSyncIdentity = {
  loadedAt: 0,
  value: null
}

function getSyncConfigPath() {
  return path.join(app.getPath('userData'), SYNC_CONFIG_DIR_NAME, SYNC_CONFIG_FILE_NAME)
}

async function getSyncIdentityCached(): Promise<SyncIdentity | null> {
  const now = Date.now()
  if (now - cachedSyncIdentity.loadedAt < OUTBOX_CACHE_TTL_MS) {
    return cachedSyncIdentity.value
  }

  const config = await readJsonSafe<SyncConfigSnapshot>(getSyncConfigPath())
  if (!config?.enabled) {
    cachedSyncIdentity = { loadedAt: now, value: null }
    return null
  }

  // Mantener consistencia con googleDriveSyncManager: workspace por defecto y hostname
  // cuando el usuario aún no definió valores explícitos en ajustes.
  const workspaceId = config.workspaceId?.trim() || 'default'
  const deviceId = config.deviceName?.trim() || os.hostname() || 'Este dispositivo'

  const value = { workspaceId, deviceId }
  cachedSyncIdentity = { loadedAt: now, value }
  return value
}

function getUpdatedAtFromRecord(record: unknown) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>).updatedAt
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function toRecordId(model: string, args: Record<string, unknown>, result: unknown) {
  if (result && typeof result === 'object') {
    const maybeId = (result as Record<string, unknown>).id
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      return String(maybeId)
    }
  }

  const where = args.where
  if (where && typeof where === 'object') {
    const entries = Object.entries(where as Record<string, unknown>)
    for (const [, value] of entries) {
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value)
      }
    }
  }

  const data = args.data
  if (data && typeof data === 'object') {
    const maybeId = (data as Record<string, unknown>).id
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      return String(maybeId)
    }
  }

  if (model === 'ScheduleItem' && where && typeof where === 'object') {
    const id = (where as Record<string, unknown>).id
    if (typeof id === 'string') return id
  }

  return null
}

function toPayloadString(args: Record<string, unknown>, result: unknown) {
  const payloadBase =
    result && typeof result === 'object' ? result : (args.data ?? args.where ?? {})
  return serializeOutboxPayload(payloadBase)
}

function toOperation(action: string): SyncOperation | null {
  if (action === 'create') return SyncOperation.CREATE
  if (action === 'createMany' || action === 'createManyAndReturn') return SyncOperation.CREATE
  if (action === 'update' || action === 'upsert') return SyncOperation.UPDATE
  if (action === 'updateMany') return SyncOperation.UPDATE
  if (action === 'delete') return SyncOperation.DELETE
  if (action === 'deleteMany') return SyncOperation.DELETE
  return null
}

function toDelegateName(model: string) {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`
}

function isRecordWithId(
  value: unknown
): value is { id: string | number; updatedAt?: Date | string | null } {
  if (!value || typeof value !== 'object') return false
  const id = (value as Record<string, unknown>).id
  return typeof id === 'string' || typeof id === 'number'
}

function normalizeDataArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return [value]
  return []
}

async function appendOutboxEntry(
  client: PrismaClient,
  identity: SyncIdentity,
  data: {
    tableName: string
    recordId: string
    operation: SyncOperation
    payload: string
    entityUpdatedAt: Date
    deletedAt?: Date | null
  }
) {
  try {
    await client.syncOutboxChange.create({
      data: {
        workspaceId: identity.workspaceId,
        deviceId: identity.deviceId,
        tableName: data.tableName,
        recordId: data.recordId,
        operation: data.operation,
        payload: data.payload,
        entityUpdatedAt: data.entityUpdatedAt,
        deletedAt: data.deletedAt ?? null
      }
    })
    onOutboxWriteCallback?.()
  } catch (error) {
    log.error(
      `[sync-outbox] No se pudo registrar cambio ${data.tableName}.${data.operation}:`,
      error
    )
  }
}

export async function runWithoutSyncOutboxTracking<T>(fn: () => Promise<T>): Promise<T> {
  return await outboxContext.run({ skipOutbox: true }, fn)
}

function registerOutboxMiddleware(client: PrismaClient) {
  client.$use(async (params, next) => {
    const action = params.action
    const model = params.model
    const isInsideTransaction = params.runInTransaction === true

    if (!model || !OUTBOX_TRACKED_ACTIONS.has(action) || OUTBOX_EXCLUDED_MODELS.has(model)) {
      return await next(params)
    }

    // Evita intentar escribir outbox con otro connection/contexto cuando SQLite ya está
    // bloqueada por una transacción interactiva en curso.
    if (isInsideTransaction) {
      return await next(params)
    }

    const args = (params.args ?? {}) as Record<string, unknown>
    const delegateName = toDelegateName(model)
    const delegate = (client as unknown as Record<string, unknown>)[delegateName] as
      | {
          findMany: (args: Record<string, unknown>) => Promise<unknown[]>
        }
      | undefined

    let bulkTargetsBefore: Array<{ id: string; updatedAt?: Date | string | null }> = []
    if ((action === 'deleteMany' || action === 'updateMany') && delegate?.findMany) {
      try {
        const matches = await delegate.findMany({
          where: args.where,
          select: { id: true, updatedAt: true }
        })
        bulkTargetsBefore = matches
          .filter(isRecordWithId)
          .map((row) => ({ id: String(row.id), updatedAt: row.updatedAt }))
      } catch (error) {
        log.error(`[sync-outbox] No se pudo pre-capturar registros para ${model}.${action}:`, error)
      }
    }

    const result = await next(params)

    // Notificar cambios de Media/Font para micro-push (ignorar escrituras del proceso de sync)
    if ((model === 'Media' || model === 'Font') && !outboxContext.getStore()?.skipOutbox) {
      onMediaChangeCallback?.()
    }

    if (outboxContext.getStore()?.skipOutbox) {
      return result
    }

    const identity = await getSyncIdentityCached()
    if (!identity) {
      return result
    }

    const operation = toOperation(action)
    if (!operation) {
      return result
    }

    if (action === 'deleteMany') {
      const deletedAt = new Date()
      for (const target of bulkTargetsBefore) {
        await appendOutboxEntry(client, identity, {
          tableName: model,
          recordId: target.id,
          operation,
          payload: serializeOutboxPayload({ id: target.id, deletedAt: deletedAt.toISOString() }),
          entityUpdatedAt: deletedAt,
          deletedAt
        })
      }
      return result
    }

    if (action === 'updateMany') {
      const dataPatch = args.data && typeof args.data === 'object' ? args.data : {}
      for (const target of bulkTargetsBefore) {
        await appendOutboxEntry(client, identity, {
          tableName: model,
          recordId: target.id,
          operation,
          payload: serializeOutboxPayload({ id: target.id, ...dataPatch }),
          entityUpdatedAt: new Date()
        })
      }
      return result
    }

    if (action === 'createMany' || action === 'createManyAndReturn') {
      const rows = normalizeDataArray(args.data)
      for (const row of rows) {
        if (!isRecordWithId(row)) continue
        await appendOutboxEntry(client, identity, {
          tableName: model,
          recordId: String(row.id),
          operation,
          payload: serializeOutboxPayload(row),
          entityUpdatedAt: new Date()
        })
      }
      return result
    }

    const recordId = toRecordId(model, args, result)
    if (!recordId) {
      return result
    }

    const entityUpdatedAt = getUpdatedAtFromRecord(result) ?? new Date()
    const deletedAt = operation === SyncOperation.DELETE ? new Date() : null

    await appendOutboxEntry(client, identity, {
      tableName: model,
      recordId,
      operation,
      payload: toPayloadString(args, result),
      entityUpdatedAt,
      deletedAt
    })

    return result
  })
}

/**
 * Hace un backup de la base de datos actual usando SQLite backup API
 * Esto es más confiable que fs.copy() para archivos SQLite en uso
 */
async function backupDatabase(dbPath: string): Promise<string | null> {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups')
    await fs.ensureDir(backupDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `dev-${timestamp}.db`)

    if (await fs.pathExists(dbPath)) {
      // Usar SQLite backup API en lugar de fs.copy() para bases de datos en uso
      const sqlite3 = await import('better-sqlite3')
      const sourceDb = sqlite3.default(dbPath, { readonly: true })

      try {
        // Crear backup usando el comando SQLite VACUUM INTO
        sourceDb.prepare(`VACUUM INTO ?`).run(backupPath)
        sourceDb.close()

        log.info(`💾 Backup de base de datos creado en: ${backupPath}`)
        return backupPath
      } catch (error) {
        sourceDb.close()
        // Fallback a fs.copy si VACUUM falla
        await fs.copy(dbPath, backupPath)
        log.info(`💾 Backup de base de datos creado (fallback) en: ${backupPath}`)
        return backupPath
      }
    } else {
      log.warn('⚠️ No se encontró base de datos para hacer backup')
      return null
    }
  } catch (error) {
    log.error('❌ Error al hacer backup de la base de datos:', error)
    return null
  }
}

/**
 * Obtiene la lista de migraciones aplicadas en la base de datos
 */
async function getAppliedMigrations(dbPath: string): Promise<string[]> {
  try {
    const sqlite3 = await import('better-sqlite3')
    const db = sqlite3.default(dbPath)

    try {
      const migrations = db
        .prepare('SELECT migration_name FROM _prisma_migrations ORDER BY finished_at')
        .all() as any[]

      db.close()
      return migrations.map((m) => m.migration_name)
    } catch (error) {
      db.close()
      // Si la tabla no existe, no hay migraciones aplicadas
      return []
    }
  } catch (error) {
    log.error('Error al obtener migraciones aplicadas:', error)
    return []
  }
}

/**
 * Obtiene la lista de migraciones disponibles en el proyecto
 */
async function getAvailableMigrations(migrationsPath: string): Promise<string[]> {
  try {
    const migrationDirs = await fs.readdir(migrationsPath)
    return migrationDirs
      .filter((dir) => dir.match(/^\d{14}_/)) // Solo directorios con formato de timestamp
      .sort() // Ordenar cronológicamente
  } catch (error) {
    log.error('Error al listar migraciones disponibles:', error)
    return []
  }
}

/**
 * Marca una migración como aplicada manualmente en la base de datos
 */
async function markMigrationAsApplied(dbPath: string, migrationName: string): Promise<void> {
  try {
    const sqlite3 = await import('better-sqlite3')
    const db = sqlite3.default(dbPath)

    try {
      // Crear tabla _prisma_migrations si no existe
      db.exec(`
        CREATE TABLE IF NOT EXISTS _prisma_migrations (
          id TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          finished_at INTEGER,
          migration_name TEXT NOT NULL,
          logs TEXT,
          rolled_back_at INTEGER,
          started_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
          applied_steps_count INTEGER NOT NULL DEFAULT 0
        );
      `)

      // Generar un ID único
      const id = `${Date.now()}-${migrationName}`
      const checksum = 'manual-migration'
      const now = Date.now()

      db.prepare(
        `
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(id, checksum, now, migrationName, now, 1)

      log.info(`✅ Migración ${migrationName} marcada como aplicada`)
    } finally {
      db.close()
    }
  } catch (error) {
    log.error(`Error al marcar migración ${migrationName}:`, error)
  }
}

/**
 * Aplica una migración SQL manualmente
 */
async function applyMigrationManually(
  dbPath: string,
  migrationPath: string,
  migrationName: string
): Promise<boolean> {
  try {
    const sqlPath = path.join(migrationPath, 'migration.sql')
    if (!(await fs.pathExists(sqlPath))) {
      log.warn(`⚠️ No se encontró migration.sql en ${migrationPath}`)
      return false
    }

    const sql = await fs.readFile(sqlPath, 'utf-8')
    const sqlite3 = await import('better-sqlite3')
    const db = sqlite3.default(dbPath)

    try {
      // Ejecutar cada statement individualmente para que ALTER TABLE que ya existan
      // no interrumpan el resto de la migración (ej: columnas ya presentes en upgrades).
      const statements = sql
        .split(';')
        .map((s) => {
          // Remover líneas de comentario sin eliminar el statement completo
          const lines = s.split('\n').filter((line) => !line.trim().startsWith('--'))
          return lines.join('\n').trim()
        })
        .filter((s) => s.length > 0)

      let failedCount = 0
      for (const statement of statements) {
        try {
          db.exec(statement + ';')
        } catch (stmtError: any) {
          // Ignorar errores esperados de idempotencia (columna/índice ya existe, etc.)
          log.warn(`⚠️ Statement skipped (${migrationName}): ${stmtError.message}`)
          failedCount++
        }
      }

      if (failedCount === statements.length) {
        log.error(`❌ Todos los statements de ${migrationName} fallaron`)
        return false
      }

      log.info(
        `✅ SQL de migración ${migrationName} ejecutado (${failedCount} statements omitidos)`
      )

      // Marcar como aplicada
      await markMigrationAsApplied(dbPath, migrationName)
      return true
    } catch (error: any) {
      log.error(`❌ Error al ejecutar SQL de ${migrationName}:`, error.message)
      return false
    } finally {
      db.close()
    }
  } catch (error: any) {
    log.error(`Error al aplicar migración ${migrationName}:`, error)
    return false
  }
}

/**
 * Ejecuta las migraciones en la DB de Electron
 */
async function runMigrations(dbPath: string, isDev: boolean) {
  try {
    log.info('🔄 Ejecutando migraciones en la base de datos local...')
    log.info('📁 DB Path:', dbPath)

    const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`

    // Hacer backup antes de migrar
    await backupDatabase(dbPath)

    const prismaBin = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
    let prismaPath: string
    let migrationsPath: string

    if (isDev) {
      prismaPath = path.join(process.cwd(), 'node_modules', '.bin', prismaBin)
      migrationsPath = path.join(process.cwd(), 'prisma', 'migrations')
    } else {
      prismaPath = path.join(process.resourcesPath, 'node_modules', '.bin', prismaBin)
      migrationsPath = path.join(process.resourcesPath, 'prisma', 'migrations')

      if (!fs.existsSync(prismaPath)) {
        prismaPath = path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          '.bin',
          prismaBin
        )
      }
      if (!fs.existsSync(migrationsPath)) {
        migrationsPath = path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'prisma',
          'migrations'
        )
      }
    }

    log.info('🔧 Prisma binary:', prismaPath)
    log.info('📂 Migrations path:', migrationsPath)
    log.info('🗄️ DATABASE_URL:', databaseUrl)

    const schemaPath = path.join(path.dirname(migrationsPath), 'schema.prisma')
    if (!fs.existsSync(schemaPath)) {
      log.error('❌ No se encontró schema.prisma en:', schemaPath)
      return false
    }

    // 🔍 Detectar y corregir problemas de migraciones
    const appliedMigrations = await getAppliedMigrations(dbPath)
    const availableMigrations = await getAvailableMigrations(migrationsPath)

    log.info(`📊 Migraciones aplicadas: ${appliedMigrations.length}`)
    log.info(`📊 Migraciones disponibles: ${availableMigrations.length}`)

    // Encontrar migraciones pendientes
    const pendingMigrations = availableMigrations.filter((m) => !appliedMigrations.includes(m))

    if (pendingMigrations.length > 0) {
      log.info(`🔄 Migraciones pendientes: ${pendingMigrations.join(', ')}`)

      // Intentar aplicar migraciones manualmente una por una
      for (const migration of pendingMigrations) {
        const migrationPath = path.join(migrationsPath, migration)
        log.info(`📝 Aplicando migración: ${migration}`)

        const success = await applyMigrationManually(dbPath, migrationPath, migration)
        if (!success) {
          log.warn(`⚠️ No se pudo aplicar ${migration}, continuando...`)
        }
      }
    } else {
      log.info('✅ No hay migraciones pendientes; se omite prisma migrate deploy')
      return true
    }

    // Intentar ejecutar migrate deploy para sincronizar
    try {
      const command = `"${prismaPath}" migrate deploy --schema="${schemaPath}"`
      log.info('🚀 Ejecutando comando Prisma:', command)

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          PRISMA_SKIP_POSTINSTALL_GENERATE: '1'
        },
        cwd: path.dirname(migrationsPath)
      })

      log.info('📤 STDOUT:', stdout)
      if (stderr) log.info('📤 STDERR:', stderr)

      if (stdout) log.info('✅ Migraciones sincronizadas:', stdout)
      if (stderr && !stderr.includes('Datasource')) log.warn('⚠️ Advertencias:', stderr)

      return true
    } catch (error: any) {
      log.warn('⚠️ Prisma migrate deploy falló, pero migraciones manuales aplicadas')
      if (error.stdout) log.info('stdout:', error.stdout)
      if (error.stderr) log.warn('stderr:', error.stderr)
      return true // Consideramos éxito si las migraciones manuales funcionaron
    }
  } catch (error: any) {
    log.error('❌ Error al ejecutar migraciones:', error.message)
    if (error.stdout) log.info('stdout:', error.stdout)
    if (error.stderr) log.error('stderr:', error.stderr)
    return false
  }
}

/**
 * Verifica que el esquema de la base de datos coincida con el esperado
 */
async function validateDatabaseSchema(dbPath: string): Promise<boolean> {
  try {
    const sqlite3 = await import('better-sqlite3')
    const db = sqlite3.default(dbPath)

    try {
      const existingTables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
        )
        .all() as { name: string }[]

      const tableNames = existingTables.map((t) => t.name)

      log.info(`📊 Tablas existentes: ${tableNames.join(', ')}`)

      // Si faltan tablas críticas del esquema actual, el esquema necesita actualizarse
      const criticalTables = ['Song', 'Themes', 'Setting']
      const missingCritical = criticalTables.filter((t) => !tableNames.includes(t))

      if (missingCritical.length > 0) {
        log.warn(`⚠️ Tablas críticas faltantes: ${missingCritical.join(', ')}`)
        db.close()
        return false
      }

      db.close()
      log.info('✅ Esquema de base de datos validado correctamente')
      return true
    } catch (error) {
      db.close()
      throw error
    }
  } catch (error) {
    log.error('Error validando esquema:', error)
    // Si no podemos validar, asumir que necesita actualizarse
    return false
  }
}

/**
 * Mapeo de columnas renombradas entre esquemas antiguos y nuevos
 */
const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  Lyrics: {
    songsTagsId: 'tagSongsId'
  },
  Media: {
    path: 'filePath'
  }
}

/**
 * Obtiene el esquema de una tabla
 */
function getTableSchema(db: any, tableName: string): Map<string, any> {
  const schema = new Map()
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]
  columns.forEach((col: any) => {
    schema.set(col.name, col)
  })
  return schema
}

/**
 * Obtiene todas las tablas de la base de datos (excluyendo tablas de sistema)
 */
function getAllTables(db: any): string[] {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
    )
    .all() as any[]
  return tables.map((t: any) => t.name)
}

/**
 * Migra datos desde un backup al nuevo esquema DINÁMICAMENTE
 * Detecta todas las tablas y sus esquemas automáticamente
 */
async function migrateDataFromBackup(backupPath: string, newDbPath: string) {
  try {
    log.info('🔄 Migrando datos desde backup al nuevo esquema...')
    const sqlite3 = await import('better-sqlite3')

    const backupDb = sqlite3.default(backupPath, { readonly: true })
    const newDb = sqlite3.default(newDbPath)

    try {
      // Obtener todas las tablas de la BD de destino (nueva)
      const destTables = getAllTables(newDb)
      log.info(`📊 Tablas a migrar: ${destTables.join(', ')}`)

      let totalMigrated = 0

      // Migrar cada tabla dinámicamente
      for (const tableName of destTables) {
        try {
          // Verificar si la tabla existe en el backup
          const backupTables = getAllTables(backupDb)
          if (!backupTables.includes(tableName)) {
            log.info(`ℹ️ Tabla ${tableName} no existe en backup, omitiendo...`)
            continue
          }

          log.info(`📋 Migrando tabla: ${tableName}...`)

          // Obtener esquemas de ambas BDs
          const backupSchema = getTableSchema(backupDb, tableName)
          const destSchema = getTableSchema(newDb, tableName)

          // Obtener todos los datos de la tabla en el backup
          const rows = backupDb.prepare(`SELECT * FROM ${tableName}`).all()

          if (rows.length === 0) {
            log.info(`ℹ️ Tabla ${tableName} vacía en backup`)
            continue
          }

          // Construir mapeo de columnas
          const columnMap = new Map<string, string>()
          const destColumns: string[] = []
          const destColumnNames = Array.from(destSchema.keys())

          // Para cada columna en destino, buscar la columna correspondiente en backup
          for (const destCol of destColumnNames) {
            let backupCol = destCol

            // Verificar si hay un mapeo explícito para esta tabla/columna
            if (COLUMN_MAPPINGS[tableName]?.[destCol]) {
              // Mapeo inverso: buscar columna vieja que mapea a esta nueva
              const mapping = COLUMN_MAPPINGS[tableName]
              const oldCol = Object.keys(mapping).find((k) => mapping[k] === destCol)
              if (oldCol && backupSchema.has(oldCol)) {
                backupCol = oldCol
              }
            } else {
              // Verificar mapeo directo (columna cambió de nombre)
              const newColName = COLUMN_MAPPINGS[tableName]?.[destCol]
              if (newColName && destSchema.has(newColName)) {
                backupCol = destCol
              }
            }

            // Verificar si la columna existe en backup
            if (backupSchema.has(backupCol)) {
              columnMap.set(destCol, backupCol)
              destColumns.push(destCol)
            } else if (
              destSchema.get(destCol)?.dflt_value !== null ||
              !destSchema.get(destCol)?.notnull
            ) {
              // Columna no existe en backup pero acepta NULL o tiene default
              destColumns.push(destCol)
            }
          }

          // Construir y ejecutar INSERT para cada fila
          const placeholders = destColumns.map(() => '?').join(', ')
          const insertSql = `INSERT INTO ${tableName} (${destColumns.join(', ')}) VALUES (${placeholders})`
          const insertStmt = newDb.prepare(insertSql)

          for (const row of rows as any[]) {
            const values: any[] = []

            for (const destCol of destColumns) {
              const backupCol = columnMap.get(destCol)

              if (backupCol) {
                let value = (row as any)[backupCol]

                // Transformaciones especiales por tabla/columna
                if (tableName === 'Media' && destCol === 'format' && !value) {
                  // Inferir format desde type si no existe
                  value = row.type === 'VIDEO' ? 'mp4' : 'jpg'
                } else if (tableName === 'Media' && destCol === 'fileSize' && !value) {
                  value = 0
                } else if (tableName === 'Media' && destCol === 'folder' && value === null) {
                  value = ''
                }

                values.push(value)
              } else {
                // Columna no existe en backup, usar NULL o default
                values.push(null)
              }
            }

            insertStmt.run(...values)
          }

          log.info(`✅ ${rows.length} registros migrados en ${tableName}`)
          totalMigrated += rows.length
        } catch (error: any) {
          log.error(`❌ Error migrando tabla ${tableName}:`, error.message)
          // Continuar con las demás tablas
        }
      }

      log.info(`✅ ¡Migración completada! ${totalMigrated} registros totales migrados`)
    } finally {
      backupDb.close()
      newDb.close()
    }
  } catch (error) {
    log.error('❌ Error migrando datos desde backup:', error)
    throw error
  }
}

/**
 * Detecta si hay datos en tablas importantes
 */
async function hasUserData(dbPath: string): Promise<boolean> {
  try {
    const tempPrisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } }
    })
    await tempPrisma.$connect()

    const modelsToCheck = ['song', 'themes', 'setting']
    const prismaRecord = tempPrisma as unknown as Record<string, unknown>

    const counts = await Promise.all(
      modelsToCheck.map(async (model) => {
        const delegate = prismaRecord[model] as { count?: () => Promise<number> } | undefined

        if (!delegate || typeof delegate.count !== 'function') {
          return 0
        }

        try {
          return await delegate.count()
        } catch {
          return 0
        }
      })
    )

    await tempPrisma.$disconnect()
    return counts.some((c) => c > 0)
  } catch (error) {
    log.error('Error verificando datos de usuario:', error)
    return true
  }
}

/**
 * Inicializa Prisma, copia DB si no existe, hace backup y ejecuta migraciones
 */
async function initPrisma() {
  try {
    const isDev = !app.isPackaged

    // En desarrollo: usar prisma/dev.db del proyecto
    // En producción: usar ~/Library/Application Support/ecclesia/dev.db
    const destDbPath = isDev
      ? path.resolve(process.cwd(), 'prisma', 'dev.db')
      : path.join(app.getPath('userData'), 'dev.db')

    // Solo copiar base de datos inicial si NO existe (primera vez)
    if (!(await fs.pathExists(destDbPath))) {
      log.info('📦 Primera vez: creando base de datos inicial...')

      const srcDbPath = getTemplateDbPath(isDev)

      if (await fs.pathExists(srcDbPath)) {
        await fs.copy(srcDbPath, destDbPath)
        log.info('✅ Base de datos inicial copiada desde plantilla:', srcDbPath)
      } else {
        log.info('🆕 No hay DB inicial, se creará con las migraciones')
      }
    } else {
      log.info('💾 Usando base de datos existente (preservando datos):', destDbPath)
    }

    // Validar que el esquema sea correcto ANTES de migrar
    log.info('🔍 Validando esquema de base de datos...')
    const isSchemaValid = await validateDatabaseSchema(destDbPath)

    if (!isSchemaValid) {
      log.warn('⚠️ Esquema desactualizado detectado. Recreando base de datos...')
      const hasData = await hasUserData(destDbPath)

      let backupPathForMigration: string | null = null

      if (hasData) {
        log.info('💾 Creando backup antes de recrear...')
        const backupDir = path.join(app.getPath('userData'), 'backups')
        await fs.ensureDir(backupDir)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        backupPathForMigration = path.join(backupDir, `migration-${timestamp}.db`)
        await fs.copy(destDbPath, backupPathForMigration)
        log.warn('⚠️ DATOS IMPORTANTES: Backup guardado en:', backupPathForMigration)
      }

      // Borrar DB corrupta
      await fs.remove(destDbPath)
      log.info('🗑️ Base de datos antigua eliminada')

      // Intentar copiar DB limpia del proyecto (si existe)
      const srcDbPath = getTemplateDbPath(isDev)

      if (await fs.pathExists(srcDbPath)) {
        await fs.copy(srcDbPath, destDbPath)
        log.info('✅ Base de datos limpia copiada desde el proyecto')
      } else {
        // Crear DB vacía aplicando migraciones
        log.info('🆕 Creando nueva base de datos desde cero...')
        await runMigrations(destDbPath, isDev)
      }

      // Migrar datos del backup si teníamos datos
      if (backupPathForMigration && hasData) {
        try {
          await migrateDataFromBackup(backupPathForMigration, destDbPath)
          log.info('🎉 ¡Tus datos han sido migrados exitosamente al nuevo esquema!')
        } catch (error) {
          log.error(
            '❌ Error al migrar datos. El backup está disponible en:',
            backupPathForMigration
          )
          log.error('Puedes restaurarlo manualmente si es necesario')
        }
      }
    }

    // SIEMPRE ejecutar migraciones (en dev y prod)
    log.info('🔄 Aplicando migraciones pendientes...')
    const migrationSuccess = await runMigrations(destDbPath, isDev)

    if (!migrationSuccess) {
      const hasData = await hasUserData(destDbPath)
      if (hasData) {
        log.error('❌ ERROR: La migración falló pero hay datos de usuario. Se usará la DB actual.')
        log.warn('⚠️ Revisa los logs y considera aplicar la migración manualmente.')
      } else {
        log.info('🔄 Recreando base de datos desde cero (sin datos de usuario)...')
        await fs.remove(destDbPath)

        const srcDbPath = getTemplateDbPath(isDev)

        if (await fs.pathExists(srcDbPath)) {
          await fs.copy(srcDbPath, destDbPath)
          await runMigrations(destDbPath, isDev)
        } else {
          // Crear DB vacía y aplicar migraciones
          await runMigrations(destDbPath, isDev)
        }
      }
    }

    if (prisma) {
      await prisma.$disconnect()
      prisma = null
    }

    prisma = new PrismaClient({
      datasources: { db: { url: `file:${destDbPath.replace(/\\/g, '/')}` } }
    })
    registerOutboxMiddleware(prisma)
    await prisma.$connect()
    log.info('✅ Prisma conectado a la base de datos')
    return prisma
  } catch (error) {
    log.error('❌ Error al inicializar Prisma:', error)
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
