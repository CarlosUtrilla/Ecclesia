import { PrismaClient, SyncOperation } from '@prisma/client'
import path from 'path'
import fs from 'fs-extra'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { serializeOutboxPayload } from './outboxPayload'
import {
  setPrismaClient,
  outboxContext,
  runWithoutSyncOutboxTracking,
  setGetBiblesResourcesPath,
  getBiblesResourcesPath
} from './prisma'
import { log } from './utils/logger'

export type DatabaseConfig = {
  isDev: boolean
  userDataPath?: string
  resourcesPath?: string
  cwd: string
}

function getDefaultDatabaseConfig(cwd?: string): DatabaseConfig {
  return {
    isDev: true,
    userDataPath: path.join(os.homedir(), '.ecclesia'),
    cwd: cwd ?? process.cwd()
  }
}

const execAsync = promisify(exec)
let prisma: PrismaClient | null = null
const PACKAGED_DB_TEMPLATE_NAME = 'empty-prod.db'

function getTemplateDbPath(isDev: boolean, cwd: string, resourcesPath: string): string {
  return isDev
    ? path.resolve(cwd, '..', 'api', 'prisma', PACKAGED_DB_TEMPLATE_NAME)
    : path.join(resourcesPath, 'prisma', PACKAGED_DB_TEMPLATE_NAME)
}

async function withTempDb<T>(dbPath: string, fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } }
  })
  try {
    await prisma.$connect()
    return await fn(prisma)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
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

function getSyncConfigPath(userDataPath: string) {
  return path.join(userDataPath, SYNC_CONFIG_DIR_NAME, SYNC_CONFIG_FILE_NAME)
}

async function getSyncIdentityCached(userDataPath: string): Promise<SyncIdentity | null> {
  const now = Date.now()
  if (now - cachedSyncIdentity.loadedAt < OUTBOX_CACHE_TTL_MS) {
    return cachedSyncIdentity.value
  }

  const config = await readJsonSafe<SyncConfigSnapshot>(getSyncConfigPath(userDataPath))
  if (!config?.enabled) {
    cachedSyncIdentity = { loadedAt: now, value: null }
    return null
  }

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
    console.error(
      `[sync-outbox] No se pudo registrar cambio ${data.tableName}.${data.operation}:`,
      error
    )
  }
}

export { runWithoutSyncOutboxTracking }

function registerOutboxMiddleware(client: PrismaClient, userDataPath: string): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            !model ||
            !OUTBOX_TRACKED_ACTIONS.has(operation) ||
            OUTBOX_EXCLUDED_MODELS.has(model)
          ) {
            return await query(args)
          }

          const delegateName = toDelegateName(model)
          const delegate = (client as unknown as Record<string, unknown>)[delegateName] as
            | {
                findMany: (args: Record<string, unknown>) => Promise<unknown[]>
              }
            | undefined

          let bulkTargetsBefore: Array<{ id: string; updatedAt?: Date | string | null }> = []
          if ((operation === 'deleteMany' || operation === 'updateMany') && delegate?.findMany) {
            try {
              const matches = await delegate.findMany({
                where: (args as Record<string, unknown>).where as Record<string, unknown>,
                select: { id: true, updatedAt: true }
              })
              bulkTargetsBefore = matches
                .filter(isRecordWithId)
                .map((row) => ({ id: String(row.id), updatedAt: row.updatedAt }))
            } catch (error) {
              console.error(
                `[sync-outbox] No se pudo pre-capturar registros para ${model}.${operation}:`,
                error
              )
            }
          }

          const result = await query(args)

          if (
            (model === 'Media' || model === 'Font') &&
            !outboxContext.getStore()?.skipOutbox
          ) {
            onMediaChangeCallback?.()
          }

          if (outboxContext.getStore()?.skipOutbox) {
            return result
          }

          const identity = await getSyncIdentityCached(userDataPath)
          if (!identity) {
            return result
          }

          const outboxOperation = toOperation(operation)
          if (!outboxOperation) {
            return result
          }

          if (operation === 'deleteMany') {
            const deletedAt = new Date()
            for (const target of bulkTargetsBefore) {
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: target.id,
                operation: outboxOperation,
                payload: serializeOutboxPayload({
                  id: target.id,
                  deletedAt: deletedAt.toISOString()
                }),
                entityUpdatedAt: deletedAt,
                deletedAt
              })
            }
            return result
          }

          if (operation === 'updateMany') {
            const dataPatch =
              args &&
              typeof args === 'object' &&
              'data' in args &&
              args.data &&
              typeof args.data === 'object'
                ? args.data
                : {}
            for (const target of bulkTargetsBefore) {
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: target.id,
                operation: outboxOperation,
                payload: serializeOutboxPayload({ id: target.id, ...dataPatch }),
                entityUpdatedAt: new Date()
              })
            }
            return result
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const dataArray =
              args && typeof args === 'object' && 'data' in args ? args.data : undefined
            const rows = normalizeDataArray(dataArray)
            for (const row of rows) {
              if (!isRecordWithId(row)) continue
              await appendOutboxEntry(client, identity, {
                tableName: model,
                recordId: String(row.id),
                operation: outboxOperation,
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
          const deletedAt = outboxOperation === SyncOperation.DELETE ? new Date() : null

          await appendOutboxEntry(client, identity, {
            tableName: model,
            recordId,
            operation: outboxOperation,
            payload: toPayloadString(args, result),
            entityUpdatedAt,
            deletedAt
          })

          return result
        }
      }
    }
  }) as unknown as PrismaClient
}

async function backupDatabase(dbPath: string, userDataPath: string): Promise<string | null> {
  try {
    const backupDir = path.join(userDataPath, 'backups')
    await fs.ensureDir(backupDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `dev-${timestamp}.db`)

    if (await fs.pathExists(dbPath)) {
      let backupOk = false
      try {
        await withTempDb(dbPath, async (prisma) => {
          await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`)
        })
        backupOk = true
      } catch {
        // VACUUM INTO fallback: simple file copy
      }

      if (backupOk) {
        console.log(`💾 Backup de base de datos creado en: ${backupPath}`)
        return backupPath
      }

      try {
        await fs.copy(dbPath, backupPath)
        console.log(`💾 Backup de base de datos creado (fallback) en: ${backupPath}`)
        return backupPath
      } catch {
        console.warn('⚠️ Falló también el backup por copia directa')
        return null
      }
    } else {
      console.warn('⚠️ No se encontró base de datos para hacer backup')
      return null
    }
  } catch (error) {
    console.error('❌ Error al hacer backup de la base de datos:', error)
    return null
  }
}

async function getAppliedMigrations(dbPath: string): Promise<string[]> {
  try {
    const migrations = await withTempDb(dbPath, async (prisma) => {
      const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
        'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at'
      )
      return rows.map((r) => r.migration_name)
    })
    return migrations
  } catch (error) {
    console.error('Error al obtener migraciones aplicadas:', error)
    return []
  }
}

async function getAvailableMigrations(migrationsPath: string): Promise<string[]> {
  try {
    const migrationDirs = await fs.readdir(migrationsPath)
    return migrationDirs.filter((dir) => dir.match(/^\d{14}_/)).sort()
  } catch (error) {
    console.error('Error al listar migraciones disponibles:', error)
    return []
  }
}

async function markMigrationAsApplied(dbPath: string, migrationName: string): Promise<void> {
  try {
    await withTempDb(dbPath, async (prisma) => {
      await prisma.$executeRawUnsafe(`
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

      const id = `${Date.now()}-${migrationName}`
      const checksum = 'manual-migration'
      const now = Date.now()

      await prisma.$executeRawUnsafe(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id, checksum, now, migrationName, now, 1
      )
    })

    console.log(`✅ Migración ${migrationName} marcada como aplicada`)
  } catch (error) {
    console.error(`Error al marcar migración ${migrationName}:`, error)
  }
}

async function applyMigrationManually(
  dbPath: string,
  migrationPath: string,
  migrationName: string
): Promise<boolean> {
  try {
    const sqlPath = path.join(migrationPath, 'migration.sql')
    if (!(await fs.pathExists(sqlPath))) {
      console.warn(`⚠️ No se encontró migration.sql en ${migrationPath}`)
      return false
    }

    const sql = await fs.readFile(sqlPath, 'utf-8')

    let failedCount = 0
    let statements: string[] = []
    await withTempDb(dbPath, async (prisma) => {
      statements = sql
        .split(';')
        .map((s) => {
          const lines = s.split('\n').filter((line) => !line.trim().startsWith('--'))
          return lines.join('\n').trim()
        })
        .filter((s) => s.length > 0)

      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement + ';')
        } catch (stmtError: any) {
          console.warn(`⚠️ Statement skipped (${migrationName}): ${stmtError.message}`)
          failedCount++
        }
      }
    })

    if (failedCount === statements.length) {
      console.error(`❌ Todos los statements de ${migrationName} fallaron`)
      return false
    }

    console.log(
      `✅ SQL de migración ${migrationName} ejecutado (${failedCount} statements omitidos)`
    )

    await markMigrationAsApplied(dbPath, migrationName)
    return true
  } catch (error: any) {
    console.error(`Error al aplicar migración ${migrationName}:`, error)
    return false
  }
}

async function runMigrations(
  dbPath: string,
  isDev: boolean,
  cwd: string,
  resourcesPath: string,
  userDataPath: string
) {
  try {
    console.log('🔄 Ejecutando migraciones en la base de datos local...')
    console.log('📁 DB Path:', dbPath)

    const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`

    await backupDatabase(dbPath, userDataPath)

    const prismaBin = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
    let prismaPath: string
    let migrationsPath: string

    if (isDev) {
      prismaPath = path.resolve(cwd, '..', 'node_modules', '.bin', prismaBin)
      migrationsPath = path.resolve(cwd, '..', 'api', 'prisma', 'migrations')
    } else {
      prismaPath = path.join(resourcesPath, 'node_modules', '.bin', prismaBin)
      migrationsPath = path.join(resourcesPath, 'prisma', 'migrations')

      if (!fs.existsSync(prismaPath)) {
        prismaPath = path.join(
          resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          '.bin',
          prismaBin
        )
      }
      if (!fs.existsSync(migrationsPath)) {
        migrationsPath = path.join(resourcesPath, 'app.asar.unpacked', 'prisma', 'migrations')
      }
    }

    console.log('🔧 Prisma binary:', prismaPath)
    console.log('📂 Migrations path:', migrationsPath)
    console.log('🗄️ DATABASE_URL:', databaseUrl)

    const schemaPath = path.join(path.dirname(migrationsPath), 'schema.prisma')
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ No se encontró schema.prisma en:', schemaPath)
      return false
    }

    const appliedMigrations = await getAppliedMigrations(dbPath)
    const availableMigrations = await getAvailableMigrations(migrationsPath)

    console.log(`📊 Migraciones aplicadas: ${appliedMigrations.length}`)
    console.log(`📊 Migraciones disponibles: ${availableMigrations.length}`)

    const pendingMigrations = availableMigrations.filter((m) => !appliedMigrations.includes(m))

    if (pendingMigrations.length > 0) {
      console.log(`🔄 Migraciones pendientes: ${pendingMigrations.join(', ')}`)

      for (const migration of pendingMigrations) {
        const migrationPath = path.join(migrationsPath, migration)
        console.log(`📝 Aplicando migración: ${migration}`)

        const success = await applyMigrationManually(dbPath, migrationPath, migration)
        if (!success) {
          console.warn(`⚠️ No se pudo aplicar ${migration}, continuando...`)
        }
      }
    } else {
      console.log('✅ No hay migraciones pendientes; se omite prisma migrate deploy')
      return true
    }

    try {
      const command = `"${prismaPath}" migrate deploy --schema="${schemaPath}"`
      console.log('🚀 Ejecutando comando Prisma:', command)

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          PRISMA_SKIP_POSTINSTALL_GENERATE: '1'
        },
        cwd: path.dirname(migrationsPath)
      })

      console.log('📤 STDOUT:', stdout)
      if (stderr) console.log('📤 STDERR:', stderr)

      if (stdout) console.log('✅ Migraciones sincronizadas:', stdout)
      if (stderr && !stderr.includes('Datasource')) console.warn('⚠️ Advertencias:', stderr)

      return true
    } catch (error: any) {
      console.warn('⚠️ Prisma migrate deploy falló, pero migraciones manuales aplicadas')
      if (error.stdout) console.log('stdout:', error.stdout)
      if (error.stderr) console.warn('stderr:', error.stderr)
      return true
    }
  } catch (error: any) {
    console.error('❌ Error al ejecutar migraciones:', error.message)
    if (error.stdout) console.log('stdout:', error.stdout)
    if (error.stderr) console.error('stderr:', error.stderr)
    return false
  }
}

async function validateDatabaseSchema(dbPath: string): Promise<boolean> {
  try {
    const tableNames = await withTempDb(dbPath, async (prisma) => {
      const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
      )
      return rows.map((r) => r.name)
    })

    console.log(`📊 Tablas existentes: ${tableNames.join(', ')}`)

    const criticalTables = ['Song', 'Themes', 'Setting']
    const missingCritical = criticalTables.filter((t) => !tableNames.includes(t))

    if (missingCritical.length > 0) {
      console.warn(`⚠️ Tablas críticas faltantes: ${missingCritical.join(', ')}`)
      return false
    }

    console.log('✅ Esquema de base de datos validado correctamente')
    return true
  } catch (error) {
    log.error('❌ Error validando esquema de base de datos:', error instanceof Error ? error.message : error)
    return false
  }
}

const COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  Lyrics: {
    songsTagsId: 'tagSongsId'
  },
  Media: {
    path: 'filePath'
  }
}

async function getTableSchema(prisma: PrismaClient, tableName: string): Promise<Map<string, any>> {
  const schema = new Map()
  const columns = await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("${tableName}")`)
  columns.forEach((col: any) => {
    schema.set(col.name, col)
  })
  return schema
}

async function getAllTables(prisma: PrismaClient): Promise<string[]> {
  const tables = await prisma.$queryRawUnsafe<any[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  )
  return tables.map((t: any) => t.name)
}

async function migrateDataFromBackup(backupPath: string, newDbPath: string) {
  try {
    console.log('🔄 Migrando datos desde backup al nuevo esquema...')
    const backupPrisma = new PrismaClient({
      datasources: { db: { url: `file:${backupPath.replace(/\\/g, '/')}` } }
    })
    const newPrisma = new PrismaClient({
      datasources: { db: { url: `file:${newDbPath.replace(/\\/g, '/')}` } }
    })

    try {
      await Promise.all([backupPrisma.$connect(), newPrisma.$connect()])

      const destTables = await getAllTables(newPrisma)
      console.log(`📊 Tablas a migrar: ${destTables.join(', ')}`)

      let totalMigrated = 0

      for (const tableName of destTables) {
        try {
          const backupTables = await getAllTables(backupPrisma)
          if (!backupTables.includes(tableName)) {
            console.log(`ℹ️ Tabla ${tableName} no existe en backup, omitiendo...`)
            continue
          }

          console.log(`📋 Migrando tabla: ${tableName}...`)

          const backupSchema = await getTableSchema(backupPrisma, tableName)
          const destSchema = await getTableSchema(newPrisma, tableName)

          const rows = await backupPrisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tableName}"`)

          if (rows.length === 0) {
            console.log(`ℹ️ Tabla ${tableName} vacía en backup`)
            continue
          }

          const columnMap = new Map<string, string>()
          const destColumns: string[] = []
          const destColumnNames = Array.from(destSchema.keys())

          for (const destCol of destColumnNames) {
            let backupCol = destCol

            if (COLUMN_MAPPINGS[tableName]?.[destCol]) {
              const mapping = COLUMN_MAPPINGS[tableName]
              const oldCol = Object.keys(mapping).find((k) => mapping[k] === destCol)
              if (oldCol && backupSchema.has(oldCol)) {
                backupCol = oldCol
              }
            } else {
              const newColName = COLUMN_MAPPINGS[tableName]?.[destCol]
              if (newColName && destSchema.has(newColName)) {
                backupCol = destCol
              }
            }

            if (backupSchema.has(backupCol)) {
              columnMap.set(destCol, backupCol)
              destColumns.push(destCol)
            } else if (
              destSchema.get(destCol)?.dflt_value !== null ||
              !destSchema.get(destCol)?.notnull
            ) {
              destColumns.push(destCol)
            }
          }

          for (const row of rows) {
            const values: any[] = []

            for (const destCol of destColumns) {
              const backupCol = columnMap.get(destCol)

              if (backupCol) {
                let value = (row as any)[backupCol]

                if (tableName === 'Media' && destCol === 'format' && !value) {
                  value = row.type === 'VIDEO' ? 'mp4' : 'jpg'
                } else if (tableName === 'Media' && destCol === 'fileSize' && !value) {
                  value = 0
                } else if (tableName === 'Media' && destCol === 'folder' && value === null) {
                  value = ''
                }

                values.push(value)
              } else {
                values.push(null)
              }
            }

            const placeholders = destColumns.map(() => '?').join(', ')
            await newPrisma.$executeRawUnsafe(
              `INSERT INTO "${tableName}" (${destColumns.join(', ')}) VALUES (${placeholders})`,
              ...values
            )
          }

          console.log(`✅ ${rows.length} registros migrados en ${tableName}`)
          totalMigrated += rows.length
        } catch (error: any) {
          console.error(`❌ Error migrando tabla ${tableName}:`, error.message)
        }
      }

      console.log(`✅ ¡Migración completada! ${totalMigrated} registros totales migrados`)
    } finally {
      await backupPrisma.$disconnect().catch(() => {})
      await newPrisma.$disconnect().catch(() => {})
    }
  } catch (error) {
    console.error('❌ Error migrando datos desde backup:', error)
    throw error
  }
}

async function hasUserData(dbPath: string): Promise<boolean> {
  try {
    if (!(await fs.pathExists(dbPath))) {
      return false
    }

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
    console.error('Error verificando datos de usuario:', error)
    return false
  }
}

async function initializeDatabase(config: DatabaseConfig) {
  try {
    const isDev = config.isDev
    const resolvedUserDataPath = config.userDataPath ?? path.join(os.homedir(), '.ecclesia')
    const resolvedResourcesPath = config.resourcesPath ?? config.cwd
    log.info('Eviroment is dev:', isDev)
    const destDbPath = isDev
      ? path.resolve(config.cwd, '..', 'api', 'prisma', 'dev.db')
      : path.join(resolvedUserDataPath, 'dev.db')

    let wasJustCreated = false

    if (!(await fs.pathExists(destDbPath))) {
      log.info('📦 Primera vez: creando base de datos inicial...')

      const srcDbPath = getTemplateDbPath(isDev, config.cwd, resolvedResourcesPath)

      if (await fs.pathExists(srcDbPath)) {
        await fs.copy(srcDbPath, destDbPath)
        wasJustCreated = true
        log.info('✅ Base de datos inicial copiada desde plantilla:', srcDbPath)
      } else {
        log.info('🆕 No hay DB inicial, se creará con las migraciones')
        const firstRunOk = await runMigrations(
          destDbPath,
          isDev,
          config.cwd,
          resolvedResourcesPath,
          resolvedUserDataPath
        )
        if (!firstRunOk) {
          log.error('❌ No se pudo crear la base de datos inicial')
          throw new Error('Failed to create initial database')
        }
        wasJustCreated = true
        log.info('✅ Base de datos creada desde migraciones')
      }
    } else {
      log.info('💾 Usando base de datos existente (preservando datos):', destDbPath)
    }

    let migrationsAlreadyApplied = wasJustCreated

    if (!wasJustCreated) {
      log.info('🔍 Validando esquema de base de datos...')
      const isSchemaValid = await validateDatabaseSchema(destDbPath)

      if (!isSchemaValid) {
        log.warn('⚠️ Esquema desactualizado detectado. Recreando base de datos...')
        const hasData = await hasUserData(destDbPath)

        let backupPathForMigration: string | null = null

        if (hasData) {
          log.info('💾 Creando backup antes de recrear...')
          const backupDir = path.join(resolvedUserDataPath, 'backups')
          await fs.ensureDir(backupDir)
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          backupPathForMigration = path.join(backupDir, `migration-${timestamp}.db`)
          await fs.copy(destDbPath, backupPathForMigration)
          log.warn('⚠️ DATOS IMPORTANTES: Backup guardado en:', backupPathForMigration)
        }

        await fs.remove(destDbPath)
        log.info('🗑️ Base de datos antigua eliminada')

        const srcDbPath = getTemplateDbPath(isDev, config.cwd, resolvedResourcesPath)

        if (await fs.pathExists(srcDbPath)) {
          await fs.copy(srcDbPath, destDbPath)
          log.info('✅ Base de datos limpia copiada desde el proyecto')
        } else {
          log.info('🆕 Creando nueva base de datos desde cero...')
          const rebuildOk = await runMigrations(
            destDbPath,
            isDev,
            config.cwd,
            resolvedResourcesPath,
            resolvedUserDataPath
          )
          if (!rebuildOk) {
            log.error('❌ No se pudo reconstruir la base de datos')
            throw new Error('Failed to rebuild database after schema validation failure')
          }
        }

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

        migrationsAlreadyApplied = true
      }
    }

    if (!migrationsAlreadyApplied) {
      log.info('🔄 Aplicando migraciones pendientes...')
      const migrationSuccess = await runMigrations(
        destDbPath,
        isDev,
        config.cwd,
        resolvedResourcesPath,
        resolvedUserDataPath
      )

      if (!migrationSuccess) {
        const hasData = await hasUserData(destDbPath)
        if (hasData) {
          log.error('❌ ERROR: La migración falló pero hay datos de usuario. Se usará la DB actual.')
          log.warn('⚠️ Revisa los logs y considera aplicar la migración manualmente.')
        } else {
          log.info('🔄 Recreando base de datos desde cero (sin datos de usuario)...')
          await fs.remove(destDbPath)

          const srcDbPath = getTemplateDbPath(isDev, config.cwd, resolvedResourcesPath)

          if (await fs.pathExists(srcDbPath)) {
            await fs.copy(srcDbPath, destDbPath)
            await runMigrations(
              destDbPath,
              isDev,
              config.cwd,
              resolvedResourcesPath,
              resolvedUserDataPath
            )
          } else {
            await runMigrations(
              destDbPath,
              isDev,
              config.cwd,
              resolvedResourcesPath,
              resolvedUserDataPath
            )
          }
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

    // Configurar ruta por defecto de biblias si no se ha establecido externamente
    try {
      getBiblesResourcesPath()
    } catch {
      setGetBiblesResourcesPath(() => path.join(resolvedResourcesPath, 'resources', 'bibles'))
    }

    prisma = registerOutboxMiddleware(prisma, resolvedUserDataPath)
    setPrismaClient(prisma)
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
    throw new Error('Prisma no ha sido inicializado. Llama primero a initializeDatabase()')
  }
  return prisma
}

export async function initializeBibleData(): Promise<void> {
  try {
    const { BibleManagmentService } = await import('./controllers/bible/bibleManagment.service')
    const prisma = getPrisma()

    const hasSchema = await prisma.bibleSchema.findFirst()
    if (hasSchema) {
      log.info('📖 Bible schema already initialized, skipping')
      return
    }

    log.info('📖 Initializing Bible schema data...')
    const bibleService = new BibleManagmentService()

    await runWithoutSyncOutboxTracking(async () => {
      await bibleService.generateBibleSchema()
      await bibleService.checkInitialBibleSettings()
    })

    log.info('✅ Bible schema data initialized')
  } catch (error) {
    log.error('❌ Error initializing Bible data:', error)
  }
}

export { initializeDatabase, getPrisma, registerOutboxMiddleware, getDefaultDatabaseConfig }
