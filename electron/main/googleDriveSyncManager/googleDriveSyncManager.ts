import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs-extra'
import path from 'path'
import http from 'http'
import { createHash } from 'crypto'
import { google } from 'googleapis'
import { SyncOperation } from '@prisma/client'
import SyncService from '../../../database/controllers/sync/sync.service'
import { getPrisma } from '../prisma'

type GoogleDriveSyncConfig = {
  enabled: boolean
  workspaceId: string
  deviceName: string
  conflictStrategy: 'lastWriteWins' | 'askBeforeOverwrite' | 'primaryDevice'
  primaryDeviceName?: string
  autoOnStart: boolean
  autoEvery5Min: boolean
  autoOnSave: boolean
  autoOnClose: boolean
}

type PersistedSyncConfig = GoogleDriveSyncConfig & {
  updatedAt: string
}

type SyncState = {
  lastSyncAt?: string
  lastRemoteModifiedAt?: string
  conflictDetected?: boolean
  nextRunAt?: string
  lastRunAt?: string
  lastRunReason?: SyncReason
  lastRunStatus?: 'ok' | 'error'
  lastRunError?: string
  retryCount?: number
  nextRetryAt?: string
  schedulerHealthy?: boolean
  lastSchedulerHeartbeatAt?: string
}

type SyncStatus = {
  connected: boolean
  accountEmail?: string
  accountName?: string
  pendingRestore: boolean
  workspaceId?: string
  lastSyncAt?: string
  syncing?: boolean
  progress?: number
  conflictDetected?: boolean
  remoteModifiedAt?: string
  pendingOutboxChanges?: number
  pendingInboxChanges?: number
  nextRunAt?: string
  lastRunAt?: string
  lastRunReason?: SyncReason
  lastRunStatus?: 'ok' | 'error'
  lastRunError?: string
  retryCount?: number
  nextRetryAt?: string
  schedulerHealthy?: boolean
  lastSchedulerHeartbeatAt?: string
}

type SyncReason =
  | 'startup'
  | 'interval'
  | 'save'
  | 'close'
  | 'manual-push'
  | 'manual-pull'
  | 'retry'

type RemoteManifest = {
  schemaVersion: number
  workspaceId: string
  deviceName: string
  updatedAt: string
  lastSyncAt: string
}

type RemoteDeviceChange = {
  remoteChangeId: string
  tableName: string
  recordId: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  payload: string
  entityUpdatedAt: string
  deletedAt?: string | null
}

type RemoteDeviceChangesFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  changes: RemoteDeviceChange[]
}

type MediaManifestEntry = {
  path: string
  size: number
  checksum: string
  mtime: number
  deletedAt?: string | null
  lastSyncedAt?: string | null
}

type MediaManifestFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  entries: MediaManifestEntry[]
}

type ReconcileResult = {
  dbIndexed: number
  mediaIndexed: number
  workspaceId: string
  deviceId: string
}

type SnapshotModelDefinition = {
  modelName: string
  delegateName: string
}

const SYNC_DIR_NAME = 'sync'
const CONFIG_FILE_NAME = 'google-drive-config.json'
const TOKEN_FILE_NAME = 'google-drive-token.json'
const STATE_FILE_NAME = 'google-drive-state.json'
const MANIFEST_SCHEMA_VERSION = 1
const REMOTE_CHANGES_SCHEMA_VERSION = 1
const REMOTE_CHANGES_FILE_PREFIX = 'ecclesia-diff-changes'
const MAX_REMOTE_CHANGES_PER_DEVICE = 5000
const LOCAL_MEDIA_MANIFEST_FILE_NAME = 'media-manifest.json'
const MEDIA_MANIFEST_SCHEMA_VERSION = 1
const REMOTE_MEDIA_MANIFEST_FILE_PREFIX = 'ecclesia-media-manifest'
const REMOTE_MEDIA_BLOB_FILE_PREFIX = 'ecclesia-media-blob'
const GOOGLE_REDIRECT_PORT = 53682
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000
const RETRY_BASE_DELAY_MS = 30 * 1000
const RETRY_MAX_DELAY_MS = 10 * 60 * 1000
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000
const SCHEDULER_STALE_THRESHOLD_MS = AUTO_SYNC_INTERVAL_MS * 2 + 30 * 1000

const SNAPSHOT_MODELS: SnapshotModelDefinition[] = [
  { modelName: 'Song', delegateName: 'song' },
  { modelName: 'Lyrics', delegateName: 'lyrics' },
  { modelName: 'TagSongs', delegateName: 'tagSongs' },
  { modelName: 'Font', delegateName: 'font' },
  { modelName: 'Themes', delegateName: 'themes' },
  { modelName: 'Setting', delegateName: 'setting' },
  { modelName: 'Media', delegateName: 'media' },
  { modelName: 'Presentation', delegateName: 'presentation' },
  { modelName: 'BibleSchema', delegateName: 'bibleSchema' },
  { modelName: 'BibleVerses', delegateName: 'bibleVerses' },
  { modelName: 'BiblePresentationSettings', delegateName: 'biblePresentationSettings' },
  { modelName: 'Schedule', delegateName: 'schedule' },
  { modelName: 'ScheduleGroupTemplate', delegateName: 'scheduleGroupTemplate' },
  { modelName: 'ScheduleItem', delegateName: 'scheduleItem' },
  { modelName: 'SelectedScreens', delegateName: 'selectedScreens' },
  { modelName: 'StageScreenConfig', delegateName: 'stageScreenConfig' }
]

let isSyncing = false
let syncProgress = 0
let autoSyncInterval: NodeJS.Timeout | null = null
let retrySyncTimeout: NodeJS.Timeout | null = null
let schedulerHealthInterval: NodeJS.Timeout | null = null
let lastSchedulerHeartbeat = 0

function clampSyncProgress(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function notifySyncState(syncing: boolean, progress?: number) {
  isSyncing = syncing
  syncProgress = syncing ? clampSyncProgress(progress ?? syncProgress) : 0
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('sync-state', { syncing, progress: syncProgress })
  })
}

function getSyncDir() {
  return path.join(app.getPath('userData'), SYNC_DIR_NAME)
}

function getConfigFilePath() {
  return path.join(getSyncDir(), CONFIG_FILE_NAME)
}

function getTokenFilePath() {
  return path.join(getSyncDir(), TOKEN_FILE_NAME)
}

function getStateFilePath() {
  return path.join(getSyncDir(), STATE_FILE_NAME)
}

function getLocalMediaManifestPath() {
  return path.join(getSyncDir(), LOCAL_MEDIA_MANIFEST_FILE_NAME)
}

async function ensureSyncDir() {
  await fs.ensureDir(getSyncDir())
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!(await fs.pathExists(filePath))) {
      return null
    }
    return (await fs.readJSON(filePath)) as T
  } catch {
    return null
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeJSON(filePath, value, { spaces: 2 })
}

function normalizeConfig(config: Partial<GoogleDriveSyncConfig>): GoogleDriveSyncConfig {
  return {
    enabled: Boolean(config.enabled),
    workspaceId: config.workspaceId || '',
    deviceName: config.deviceName || 'Este dispositivo',
    conflictStrategy: config.conflictStrategy || 'askBeforeOverwrite',
    primaryDeviceName: config.primaryDeviceName || '',
    autoOnStart: config.autoOnStart ?? true,
    autoEvery5Min: config.autoEvery5Min ?? true,
    autoOnSave: config.autoOnSave ?? true,
    autoOnClose: config.autoOnClose ?? true
  }
}

function getManifestFileName(workspaceId?: string) {
  const normalizedWorkspace = workspaceId?.trim() || 'default'
  return `ecclesia-diff-manifest-${normalizedWorkspace}.json`
}

function toSafeFileSegment(value?: string) {
  return (value?.trim() || 'default').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getDeviceChangesFileName(workspaceId?: string, deviceId?: string) {
  const ws = toSafeFileSegment(workspaceId)
  const dev = toSafeFileSegment(deviceId)
  return `${REMOTE_CHANGES_FILE_PREFIX}-${ws}-${dev}.json`
}

function getRemoteMediaManifestFileName(workspaceId?: string) {
  return `${REMOTE_MEDIA_MANIFEST_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}.json`
}

function getRemoteMediaBlobFileName(workspaceId: string, checksum: string) {
  return `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${checksum}.bin`
}

function getRemoteChangeOrder(change: RemoteDeviceChange) {
  const rawId = change.remoteChangeId.split(':').pop() || ''
  const parsed = Number(rawId)
  if (Number.isFinite(parsed)) return parsed
  return Number.MAX_SAFE_INTEGER
}

function isAutoReason(reason: SyncReason) {
  return reason === 'startup' || reason === 'interval' || reason === 'save' || reason === 'close'
}

export function calculateRetryDelayMs(retryCount: number) {
  const raw = RETRY_BASE_DELAY_MS * 2 ** Math.max(retryCount - 1, 0)
  return Math.min(raw, RETRY_MAX_DELAY_MS)
}

export function buildRetryBackoffState(currentRetryCount = 0, nowMs = Date.now()) {
  const retryCount = currentRetryCount + 1
  const delayMs = calculateRetryDelayMs(retryCount)
  const nextRetryAt = new Date(nowMs + delayMs).toISOString()

  return {
    retryCount,
    delayMs,
    nextRetryAt,
    nextRunAt: nextRetryAt
  }
}

function clearScheduledRetry() {
  if (retrySyncTimeout) {
    clearTimeout(retrySyncTimeout)
    retrySyncTimeout = null
  }
}

function isValidRemoteChangeOperation(value: unknown): value is RemoteDeviceChange['operation'] {
  return value === 'CREATE' || value === 'UPDATE' || value === 'DELETE'
}

function isValidRemoteDeviceChange(value: unknown): value is RemoteDeviceChange {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RemoteDeviceChange>

  if (typeof candidate.remoteChangeId !== 'string' || candidate.remoteChangeId.length === 0) {
    return false
  }
  if (typeof candidate.tableName !== 'string' || candidate.tableName.length === 0) {
    return false
  }
  if (typeof candidate.recordId !== 'string' || candidate.recordId.length === 0) {
    return false
  }
  if (!isValidRemoteChangeOperation(candidate.operation)) {
    return false
  }
  if (typeof candidate.payload !== 'string') {
    return false
  }
  if (
    typeof candidate.entityUpdatedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.entityUpdatedAt))
  ) {
    return false
  }
  if (
    candidate.deletedAt !== undefined &&
    candidate.deletedAt !== null &&
    (typeof candidate.deletedAt !== 'string' || Number.isNaN(Date.parse(candidate.deletedAt)))
  ) {
    return false
  }

  return true
}

function isValidRemoteDeviceChangesFile(
  value: unknown,
  expectedWorkspaceId: string
): value is RemoteDeviceChangesFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RemoteDeviceChangesFile>

  if (candidate.schemaVersion !== REMOTE_CHANGES_SCHEMA_VERSION) return false
  if (candidate.workspaceId !== expectedWorkspaceId) return false
  if (typeof candidate.deviceId !== 'string' || candidate.deviceId.length === 0) return false
  if (typeof candidate.updatedAt !== 'string' || Number.isNaN(Date.parse(candidate.updatedAt))) {
    return false
  }
  if (!Array.isArray(candidate.changes)) return false

  return candidate.changes.every((change) => isValidRemoteDeviceChange(change))
}

function isValidMediaManifestEntry(value: unknown): value is MediaManifestEntry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MediaManifestEntry>

  if (typeof candidate.path !== 'string' || candidate.path.length === 0) return false
  if (
    typeof candidate.size !== 'number' ||
    !Number.isFinite(candidate.size) ||
    candidate.size < 0
  ) {
    return false
  }
  if (typeof candidate.checksum !== 'string' || candidate.checksum.length === 0) return false
  if (
    typeof candidate.mtime !== 'number' ||
    !Number.isFinite(candidate.mtime) ||
    candidate.mtime < 0
  ) {
    return false
  }
  if (
    candidate.deletedAt !== undefined &&
    candidate.deletedAt !== null &&
    (typeof candidate.deletedAt !== 'string' || Number.isNaN(Date.parse(candidate.deletedAt)))
  ) {
    return false
  }
  if (
    candidate.lastSyncedAt !== undefined &&
    candidate.lastSyncedAt !== null &&
    (typeof candidate.lastSyncedAt !== 'string' || Number.isNaN(Date.parse(candidate.lastSyncedAt)))
  ) {
    return false
  }

  return true
}

function isValidRemoteMediaManifest(
  value: unknown,
  expectedWorkspaceId: string
): value is MediaManifestFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MediaManifestFile>

  if (candidate.schemaVersion !== MEDIA_MANIFEST_SCHEMA_VERSION) return false
  if (candidate.workspaceId !== expectedWorkspaceId) return false
  if (typeof candidate.deviceId !== 'string' || candidate.deviceId.length === 0) return false
  if (typeof candidate.updatedAt !== 'string' || Number.isNaN(Date.parse(candidate.updatedAt))) {
    return false
  }
  if (!Array.isArray(candidate.entries)) return false

  return candidate.entries.every((entry) => isValidMediaManifestEntry(entry))
}

async function streamToString(readable: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    readable.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    readable.on('end', () => resolve())
    readable.on('error', reject)
  })
  return Buffer.concat(chunks).toString('utf-8')
}

async function computeFileChecksum(filePath: string) {
  const hash = createHash('sha256')

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk)
    })
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })

  return hash.digest('hex')
}

async function buildLocalMediaManifest(config: PersistedSyncConfig): Promise<MediaManifestFile> {
  const prisma = getPrisma()
  const existing = await readJsonSafe<MediaManifestFile>(getLocalMediaManifestPath())
  const existingByPath = new Map(
    (existing?.entries || []).map((entry) => [entry.path, entry] as const)
  )

  const mediaRows = await prisma.media.findMany({
    select: {
      filePath: true,
      thumbnail: true,
      fallback: true
    }
  })

  const relativePathsSet = new Set<string>()
  for (const row of mediaRows) {
    if (row.filePath) relativePathsSet.add(row.filePath)
    if (row.thumbnail) relativePathsSet.add(row.thumbnail)
    if (row.fallback) relativePathsSet.add(row.fallback)
  }

  const nextEntriesMap = new Map<string, MediaManifestEntry>()
  const userMediaBase = path.join(app.getPath('userData'), 'media')

  for (const relativePath of relativePathsSet) {
    const fullPath = path.join(userMediaBase, relativePath)
    if (!(await fs.pathExists(fullPath))) {
      const previous = existingByPath.get(relativePath)
      if (previous) {
        nextEntriesMap.set(relativePath, {
          ...previous,
          deletedAt: previous.deletedAt || new Date().toISOString()
        })
      }
      continue
    }

    const stats = await fs.stat(fullPath)
    if (!stats.isFile()) continue

    const checksum = await computeFileChecksum(fullPath)
    const previous = existingByPath.get(relativePath)

    nextEntriesMap.set(relativePath, {
      path: relativePath,
      size: stats.size,
      checksum,
      mtime: stats.mtimeMs,
      deletedAt: null,
      lastSyncedAt: previous?.lastSyncedAt || null
    })
  }

  for (const [relativePath, previous] of existingByPath) {
    if (nextEntriesMap.has(relativePath)) continue
    nextEntriesMap.set(relativePath, {
      ...previous,
      deletedAt: previous.deletedAt || new Date().toISOString()
    })
  }

  return {
    schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    updatedAt: new Date().toISOString(),
    entries: Array.from(nextEntriesMap.values()).sort((a, b) => a.path.localeCompare(b.path))
  }
}

async function getRemoteMediaManifestMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
) {
  const fileName = getRemoteMediaManifestFileName(workspaceId)
  const result = await drive.files.list({
    q: `name='${fileName.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    orderBy: 'modifiedTime desc'
  })
  return result.data.files?.[0]
}

async function readRemoteMediaManifest(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
): Promise<MediaManifestFile | null> {
  const metadata = await getRemoteMediaManifestMetadata(drive, workspaceId)
  if (!metadata?.id) return null

  const response = await drive.files.get(
    { fileId: metadata.id, alt: 'media' },
    { responseType: 'stream' }
  )
  const raw = await streamToString(response.data as NodeJS.ReadableStream)

  try {
    const parsed = JSON.parse(raw)
    if (!isValidRemoteMediaManifest(parsed, workspaceId)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeRemoteMediaManifest(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  manifest: MediaManifestFile
) {
  const fileName = getRemoteMediaManifestFileName(workspaceId)
  const existing = await getRemoteMediaManifestMetadata(drive, workspaceId)

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(manifest)
  }

  if (existing?.id) {
    await drive.files.update({
      fileId: existing.id,
      media,
      fields: 'id, modifiedTime'
    })
    return
  }

  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: ['appDataFolder']
    },
    media,
    fields: 'id, modifiedTime'
  })
}

async function listRemoteMediaBlobs(drive: ReturnType<typeof google.drive>, workspaceId: string) {
  const prefix = `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-`
  const result = await drive.files.list({
    q: `name contains '${prefix.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: 'appDataFolder',
    fields: 'files(id, name)',
    pageSize: 1000
  })

  const byChecksum = new Map<string, string>()
  for (const file of result.data.files || []) {
    const name = file.name || ''
    if (!name.startsWith(prefix) || !name.endsWith('.bin') || !file.id) continue
    const checksum = name.slice(prefix.length, -'.bin'.length)
    if (!checksum) continue
    byChecksum.set(checksum, file.id)
  }

  return byChecksum
}

async function uploadMediaBlob(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  entry: MediaManifestEntry
) {
  const fullPath = path.join(app.getPath('userData'), 'media', entry.path)
  if (!(await fs.pathExists(fullPath))) {
    throw new Error(`Archivo local de media no encontrado: ${entry.path}`)
  }

  const fileName = getRemoteMediaBlobFileName(workspaceId, entry.checksum)
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(fullPath)
  }

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: ['appDataFolder']
    },
    media,
    fields: 'id'
  })

  return created.data.id || ''
}

async function downloadMediaBlobToLocal(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
  relativePath: string
) {
  const destination = path.join(app.getPath('userData'), 'media', relativePath)
  await fs.ensureDir(path.dirname(destination))

  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destination)
    ;(response.data as NodeJS.ReadableStream).pipe(writer)
    writer.on('finish', () => resolve())
    writer.on('error', reject)
  })
}

function getOAuthClient() {
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_ID || ''
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_SECRET || ''

  if (!clientId || !clientSecret) {
    throw new Error(
      'Faltan variables de entorno para OAuth de Google Drive: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET'
    )
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://127.0.0.1:${GOOGLE_REDIRECT_PORT}/oauth2callback`
  )
}

async function captureGoogleAuthCode(authUrl: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const oauthWindow = new BrowserWindow({
      title: 'Conectar Google Drive',
      width: 560,
      height: 760,
      show: false,
      autoHideMenuBar: true,
      resizable: true,
      minimizable: true,
      maximizable: false,
      webPreferences: {
        sandbox: true
      }
    })

    const timeout: NodeJS.Timeout = setTimeout(() => {
      if (!oauthWindow.isDestroyed()) {
        oauthWindow.close()
      }
      server.close()
      reject(new Error('Timeout en autenticación con Google Drive'))
    }, 240000)

    const cleanup = () => {
      clearTimeout(timeout)
      server.close()
      if (!oauthWindow.isDestroyed()) {
        oauthWindow.close()
      }
    }

    let isResolved = false

    const server = http.createServer((request, response) => {
      if (!request.url) {
        return
      }

      const callbackUrl = new URL(request.url, `http://127.0.0.1:${GOOGLE_REDIRECT_PORT}`)
      const code = callbackUrl.searchParams.get('code')
      const error = callbackUrl.searchParams.get('error')

      if (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<h2>Autenticación cancelada o rechazada.</h2>')
        cleanup()
        isResolved = true
        reject(new Error(`Google OAuth error: ${error}`))
        return
      }

      if (!code) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<h2>No se recibió código de autorización.</h2>')
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<h2>Conexión completada. Puedes volver a Ecclesia.</h2>')
      cleanup()
      isResolved = true
      resolve(code)
    })

    oauthWindow.on('ready-to-show', () => {
      oauthWindow.show()
    })

    oauthWindow.on('closed', () => {
      if (!isResolved) {
        clearTimeout(timeout)
        server.close()
        reject(new Error('Autenticación cancelada por el usuario'))
      }
    })

    server.listen(GOOGLE_REDIRECT_PORT, '127.0.0.1', async () => {
      await oauthWindow.loadURL(authUrl)
    })
  })
}

async function getDriveClient() {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  const tokens = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())

  if (!config || !tokens) {
    throw new Error('No hay configuración o sesión activa de Google Drive')
  }

  const oauthClient = getOAuthClient()
  oauthClient.setCredentials(tokens)

  return {
    config,
    drive: google.drive({ version: 'v3', auth: oauthClient }),
    oauthClient
  }
}

async function getRemoteManifestMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId?: string
) {
  const manifestFileName = getManifestFileName(workspaceId)

  const result = await drive.files.list({
    q: `name='${manifestFileName.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    orderBy: 'modifiedTime desc'
  })

  return result.data.files?.[0]
}

async function getRemoteDeviceChangesMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  deviceId: string
) {
  const fileName = getDeviceChangesFileName(workspaceId, deviceId)
  const result = await drive.files.list({
    q: `name='${fileName.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    orderBy: 'modifiedTime desc'
  })

  return result.data.files?.[0]
}

async function readRemoteDeviceChangesFile(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  deviceId: string
): Promise<RemoteDeviceChangesFile | null> {
  const metadata = await getRemoteDeviceChangesMetadata(drive, workspaceId, deviceId)
  if (!metadata?.id) return null

  const response = await drive.files.get(
    { fileId: metadata.id, alt: 'media' },
    { responseType: 'stream' }
  )

  const raw = await streamToString(response.data as NodeJS.ReadableStream)
  try {
    const parsed = JSON.parse(raw)
    if (!isValidRemoteDeviceChangesFile(parsed, workspaceId)) {
      return null
    }
    if (parsed.deviceId !== deviceId) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeRemoteDeviceChangesFile(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  deviceId: string,
  file: RemoteDeviceChangesFile
) {
  const fileName = getDeviceChangesFileName(workspaceId, deviceId)
  const existing = await getRemoteDeviceChangesMetadata(drive, workspaceId, deviceId)

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(file)
  }

  if (existing?.id) {
    await drive.files.update({
      fileId: existing.id,
      media,
      fields: 'id, modifiedTime'
    })
    return
  }

  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: ['appDataFolder']
    },
    media,
    fields: 'id, modifiedTime'
  })
}

async function listAllRemoteDeviceChangeFiles(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
) {
  const ws = toSafeFileSegment(workspaceId)
  const prefix = `${REMOTE_CHANGES_FILE_PREFIX}-${ws}-`

  const result = await drive.files.list({
    q: `name contains '${prefix.replace(/'/g, "\\'")}' and trashed = false`,
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 100
  })

  return result.data.files || []
}

async function pullRemoteChangesIntoInbox(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  syncService: SyncService
) {
  const files = await listAllRemoteDeviceChangeFiles(drive, config.workspaceId)
  let ingested = 0
  let ignored = 0
  let stale = 0
  let invalid = 0

  for (const fileMeta of files) {
    const fileName = fileMeta.name || ''
    const expectedPrefix = `${REMOTE_CHANGES_FILE_PREFIX}-${toSafeFileSegment(config.workspaceId)}-`
    if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue

    const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
    if (!deviceSegment || deviceSegment === toSafeFileSegment(config.deviceName)) {
      continue
    }

    const response = await drive.files.get(
      { fileId: fileMeta.id || '', alt: 'media' },
      { responseType: 'stream' }
    )
    const raw = await streamToString(response.data as NodeJS.ReadableStream)

    let parsed: unknown = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      invalid += 1
      continue
    }

    if (!isValidRemoteDeviceChangesFile(parsed, config.workspaceId)) {
      invalid += 1
      continue
    }

    if (parsed.deviceId === config.deviceName) {
      continue
    }

    const result = await syncService.ingestRemoteChanges({
      workspaceId: config.workspaceId,
      sourceDeviceId: parsed.deviceId,
      changes: parsed.changes
    })

    ingested += result.inserted
    ignored += result.ignored
    stale += result.stale
    invalid += result.invalid
  }

  const applied = await syncService.applyPendingInboxBatch({
    workspaceId: config.workspaceId,
    limit: 1000
  })

  return {
    ingested,
    ignored,
    stale,
    invalid,
    applied: applied.applied,
    applyFailed: applied.failed,
    applySkipped: applied.skipped
  }
}

async function pushLocalOutboxToRemote(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  syncService: SyncService
) {
  const pending = await syncService.getPendingOutboxChanges({
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    limit: 1000
  })

  if (pending.length === 0) {
    return { pushed: 0, acked: 0 }
  }

  const existing = (await readRemoteDeviceChangesFile(
    drive,
    config.workspaceId,
    config.deviceName
  )) || {
    schemaVersion: REMOTE_CHANGES_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    updatedAt: new Date().toISOString(),
    changes: []
  }

  const incomingChanges: RemoteDeviceChange[] = pending
    .filter((change) => Boolean(change.entityUpdatedAt))
    .map((change) => ({
      remoteChangeId: `${config.deviceName}:${change.id}`,
      tableName: change.tableName,
      recordId: change.recordId,
      operation: change.operation,
      payload: change.payload,
      entityUpdatedAt: change.entityUpdatedAt!.toISOString(),
      deletedAt: change.deletedAt?.toISOString() || null
    }))

  const mergedById = new Map<string, RemoteDeviceChange>()
  for (const change of existing.changes) {
    mergedById.set(change.remoteChangeId, change)
  }
  for (const change of incomingChanges) {
    mergedById.set(change.remoteChangeId, change)
  }

  const mergedChanges = Array.from(mergedById.values())
    .sort((a, b) => {
      const orderA = getRemoteChangeOrder(a)
      const orderB = getRemoteChangeOrder(b)
      if (orderA !== orderB) return orderA - orderB
      return a.remoteChangeId.localeCompare(b.remoteChangeId)
    })
    .slice(-MAX_REMOTE_CHANGES_PER_DEVICE)

  const remoteFile: RemoteDeviceChangesFile = {
    schemaVersion: REMOTE_CHANGES_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    updatedAt: new Date().toISOString(),
    changes: mergedChanges
  }

  await writeRemoteDeviceChangesFile(drive, config.workspaceId, config.deviceName, remoteFile)

  const maxPushedId = pending[pending.length - 1]?.id
  if (maxPushedId !== undefined) {
    await syncService.acknowledgeOutboxChanges({
      workspaceId: config.workspaceId,
      deviceId: config.deviceName,
      upToId: maxPushedId
    })
  }

  return { pushed: incomingChanges.length, acked: pending.length }
}

async function syncMediaManifest(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  mode: 'push' | 'pull'
) {
  const localManifest = await buildLocalMediaManifest(config)
  const remoteManifest = (await readRemoteMediaManifest(drive, config.workspaceId)) || {
    schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    updatedAt: new Date().toISOString(),
    entries: []
  }

  const localByPath = new Map(localManifest.entries.map((entry) => [entry.path, entry] as const))
  const remoteByPath = new Map(remoteManifest.entries.map((entry) => [entry.path, entry] as const))

  const remoteBlobByChecksum = await listRemoteMediaBlobs(drive, config.workspaceId)

  let uploaded = 0
  let downloaded = 0
  const nowIso = new Date().toISOString()

  if (mode === 'push') {
    for (const localEntry of localManifest.entries) {
      if (localEntry.deletedAt) {
        remoteByPath.set(localEntry.path, {
          ...localEntry,
          lastSyncedAt: nowIso
        })
        localByPath.set(localEntry.path, {
          ...localEntry,
          lastSyncedAt: nowIso
        })
        continue
      }

      const remoteEntry = remoteByPath.get(localEntry.path)
      if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt) {
        continue
      }

      if (!remoteBlobByChecksum.has(localEntry.checksum)) {
        const fileId = await uploadMediaBlob(drive, config.workspaceId, localEntry)
        if (fileId) {
          remoteBlobByChecksum.set(localEntry.checksum, fileId)
        }
      }

      uploaded += 1
      localByPath.set(localEntry.path, {
        ...localEntry,
        deletedAt: null,
        lastSyncedAt: nowIso
      })
      remoteByPath.set(localEntry.path, {
        ...localEntry,
        deletedAt: null,
        lastSyncedAt: nowIso
      })
    }
  }

  if (mode === 'pull') {
    for (const remoteEntry of remoteManifest.entries) {
      if (remoteEntry.deletedAt) {
        const localFullPath = path.join(app.getPath('userData'), 'media', remoteEntry.path)
        if (await fs.pathExists(localFullPath)) {
          await fs.remove(localFullPath)
        }

        localByPath.set(remoteEntry.path, {
          ...remoteEntry,
          lastSyncedAt: nowIso
        })
        continue
      }

      const localEntry = localByPath.get(remoteEntry.path)
      if (localEntry?.checksum === remoteEntry.checksum && !localEntry.deletedAt) {
        continue
      }

      const remoteFileId = remoteBlobByChecksum.get(remoteEntry.checksum)
      if (!remoteFileId) continue

      await downloadMediaBlobToLocal(drive, remoteFileId, remoteEntry.path)
      downloaded += 1

      localByPath.set(remoteEntry.path, {
        ...remoteEntry,
        deletedAt: null,
        lastSyncedAt: nowIso
      })
    }
  }

  const nextLocalManifest: MediaManifestFile = {
    schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName,
    updatedAt: nowIso,
    entries: Array.from(localByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
  }

  await writeJson(getLocalMediaManifestPath(), nextLocalManifest)

  if (mode === 'push') {
    const nextRemoteManifest: MediaManifestFile = {
      schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: config.deviceName,
      updatedAt: nowIso,
      entries: Array.from(remoteByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
    }
    await writeRemoteMediaManifest(drive, config.workspaceId, nextRemoteManifest)
  }

  return {
    uploaded,
    downloaded
  }
}

async function writeRemoteManifest(
  drive: ReturnType<typeof google.drive>,
  config: GoogleDriveSyncConfig
) {
  const manifestFileName = getManifestFileName(config.workspaceId)
  const existing = await getRemoteManifestMetadata(drive, config.workspaceId)

  const manifest: RemoteManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceName: config.deviceName,
    updatedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString()
  }

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(manifest)
  }

  if (existing?.id) {
    await drive.files.update({
      fileId: existing.id,
      media,
      fields: 'id, modifiedTime'
    })

    return {
      fileId: existing.id,
      modifiedTime: manifest.updatedAt
    }
  }

  const created = await drive.files.create({
    requestBody: {
      name: manifestFileName,
      parents: ['appDataFolder']
    },
    media,
    fields: 'id, modifiedTime'
  })

  return {
    fileId: created.data.id || undefined,
    modifiedTime: created.data.modifiedTime || manifest.updatedAt
  }
}

async function updateLocalSyncState(patch: SyncState) {
  const state = (await readJsonSafe<SyncState>(getStateFilePath())) || {}
  const nextState: SyncState = {
    ...state,
    ...patch
  }
  await writeJson(getStateFilePath(), nextState)
  return nextState
}

async function syncDifferential(reason: SyncReason) {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  const state = (await readJsonSafe<SyncState>(getStateFilePath())) || {}
  if (!config?.enabled) {
    return { synced: false, reason, skipped: 'disabled' as const }
  }

  const shouldRun =
    reason === 'retry' ||
    reason === 'manual-push' ||
    reason === 'manual-pull' ||
    (reason === 'startup' && config.autoOnStart) ||
    (reason === 'interval' && config.autoEvery5Min) ||
    (reason === 'save' && config.autoOnSave) ||
    (reason === 'close' && config.autoOnClose)

  if (!shouldRun || isSyncing) {
    return { synced: false, reason, skipped: 'not-eligible' as const }
  }

  if (isAutoReason(reason)) {
    const nextRetryAtMs = state.nextRetryAt ? new Date(state.nextRetryAt).getTime() : 0
    if (nextRetryAtMs && nextRetryAtMs > Date.now()) {
      return {
        synced: false,
        reason,
        skipped: 'backoff-active' as const,
        nextRetryAt: state.nextRetryAt
      }
    }
  }

  notifySyncState(true, 10)

  try {
    const { drive } = await getDriveClient()
    const syncService = new SyncService()
    const localState = (await readJsonSafe<SyncState>(getStateFilePath())) || {}

    const remote = await getRemoteManifestMetadata(drive, config.workspaceId)
    const remoteModifiedAt = remote?.modifiedTime || undefined
    const remoteIsNewer = Boolean(
      remoteModifiedAt && localState.lastSyncAt && remoteModifiedAt > localState.lastSyncAt
    )

    if (reason === 'manual-pull') {
      if (!remoteModifiedAt) {
        throw new Error('No hay snapshot remoto aún para este workspace')
      }

      notifySyncState(true, 35)
      const pullResult = await pullRemoteChangesIntoInbox(drive, config, syncService)
      notifySyncState(true, 55)
      const pullMediaResult = await syncMediaManifest(drive, config, 'pull')

      await updateLocalSyncState({
        lastSyncAt: new Date().toISOString(),
        lastRemoteModifiedAt: remoteModifiedAt,
        conflictDetected: false
      })

      notifySyncState(true, 100)
      return {
        synced: true,
        reason,
        mode: 'pull-differential',
        syncedAt: remoteModifiedAt,
        ...pullResult,
        mediaDownloaded: pullMediaResult.downloaded
      }
    }

    if (config.conflictStrategy === 'askBeforeOverwrite' && remoteIsNewer) {
      await updateLocalSyncState({
        conflictDetected: true,
        lastRemoteModifiedAt: remoteModifiedAt
      })

      notifySyncState(true, 100)
      return {
        synced: false,
        reason,
        conflictDetected: true,
        remoteModifiedAt
      }
    }

    if (config.conflictStrategy === 'primaryDevice' && config.primaryDeviceName) {
      if (config.deviceName !== config.primaryDeviceName) {
        if (remoteModifiedAt) {
          await updateLocalSyncState({
            lastSyncAt: remoteModifiedAt,
            lastRemoteModifiedAt: remoteModifiedAt,
            conflictDetected: false
          })
        }

        notifySyncState(true, 100)
        return {
          synced: false,
          reason,
          skipped: 'secondary-device' as const,
          remoteModifiedAt
        }
      }
    }

    notifySyncState(true, 55)
    const pushResult = await pushLocalOutboxToRemote(drive, config, syncService)
    notifySyncState(true, 75)
    const pushMediaResult = await syncMediaManifest(drive, config, 'push')
    notifySyncState(true, 85)
    const writeResult = await writeRemoteManifest(drive, config)

    const syncedAt = writeResult.modifiedTime || new Date().toISOString()
    await updateLocalSyncState({
      lastSyncAt: syncedAt,
      lastRemoteModifiedAt: syncedAt,
      conflictDetected: false
    })

    notifySyncState(true, 100)

    return {
      synced: true,
      reason,
      mode: 'push-differential',
      syncedAt,
      ...pushResult,
      mediaUploaded: pushMediaResult.uploaded
    }
  } catch (error: unknown) {
    await updateLocalSyncState({
      lastRunAt: new Date().toISOString(),
      lastRunReason: reason,
      lastRunStatus: 'error',
      lastRunError: error instanceof Error ? error.message : 'Error desconocido'
    })
    throw error
  } finally {
    notifySyncState(false)
  }
}

async function getGoogleDriveSyncStatus(): Promise<SyncStatus> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
  const state = await readJsonSafe<SyncState>(getStateFilePath())

  const status: SyncStatus = {
    connected: Boolean(config && token),
    pendingRestore: false,
    workspaceId: config?.workspaceId,
    lastSyncAt: state?.lastSyncAt,
    syncing: isSyncing,
    progress: isSyncing ? syncProgress : 0,
    conflictDetected: state?.conflictDetected,
    nextRunAt: state?.nextRunAt,
    lastRunAt: state?.lastRunAt,
    lastRunReason: state?.lastRunReason,
    lastRunStatus: state?.lastRunStatus,
    lastRunError: state?.lastRunError,
    retryCount: state?.retryCount,
    nextRetryAt: state?.nextRetryAt,
    schedulerHealthy: state?.schedulerHealthy,
    lastSchedulerHeartbeatAt: state?.lastSchedulerHeartbeatAt
  }

  if (!status.connected) {
    return status
  }

  if (config?.workspaceId && config?.deviceName) {
    try {
      const prisma = getPrisma()
      const [pendingOutboxChanges, pendingInboxChanges] = await Promise.all([
        prisma.syncOutboxChange.count({
          where: {
            workspaceId: config.workspaceId,
            deviceId: config.deviceName,
            ackedAt: null
          }
        }),
        prisma.syncInboxChange.count({
          where: {
            workspaceId: config.workspaceId,
            appliedAt: null
          }
        })
      ])

      status.pendingOutboxChanges = pendingOutboxChanges
      status.pendingInboxChanges = pendingInboxChanges
    } catch {
      // noop: mantener status disponible aunque falle lectura de conteos
    }
  }

  try {
    if (!config) {
      return status
    }

    const { drive } = await getDriveClient()
    const about = await drive.about.get({ fields: 'user(displayName,emailAddress)' })
    status.accountEmail = about.data.user?.emailAddress || undefined
    status.accountName = about.data.user?.displayName || undefined

    const remote = await getRemoteManifestMetadata(drive, config.workspaceId)
    status.remoteModifiedAt = remote?.modifiedTime || undefined
  } catch {
    status.connected = false
  }

  return status
}

async function connectGoogleDrive(config: GoogleDriveSyncConfig) {
  await ensureSyncDir()

  const normalizedConfig = normalizeConfig(config)
  const persistedConfig: PersistedSyncConfig = {
    ...normalizedConfig,
    updatedAt: new Date().toISOString()
  }

  await writeJson(getConfigFilePath(), persistedConfig)

  const oauthClient = getOAuthClient()
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ]
  })

  const code = await captureGoogleAuthCode(authUrl)
  const tokenResult = await oauthClient.getToken(code)
  oauthClient.setCredentials(tokenResult.tokens)

  await writeJson(getTokenFilePath(), tokenResult.tokens)

  const drive = google.drive({ version: 'v3', auth: oauthClient })
  const about = await drive.about.get({ fields: 'user(displayName,emailAddress)' })

  return {
    connected: true,
    accountEmail: about.data.user?.emailAddress || '',
    accountName: about.data.user?.displayName || '',
    workspaceId: normalizedConfig.workspaceId
  }
}

async function disconnectGoogleDrive() {
  await fs.remove(getTokenFilePath())
  await fs.remove(getConfigFilePath())
  return { connected: false }
}

export async function applyPendingDriveRestoreOnStartup() {
  // El flujo de restore por ZIP fue removido durante la migración al sync diferencial.
  return false
}

async function configureGoogleDrive(config: GoogleDriveSyncConfig) {
  await ensureSyncDir()
  const normalizedConfig = normalizeConfig(config)
  const persistedConfig: PersistedSyncConfig = {
    ...normalizedConfig,
    updatedAt: new Date().toISOString()
  }
  await writeJson(getConfigFilePath(), persistedConfig)
  return persistedConfig
}

export async function executeSyncCycle(reason: SyncReason) {
  if (isAutoReason(reason) || reason === 'retry') {
    lastSchedulerHeartbeat = Date.now()
    await updateLocalSyncState({
      lastSchedulerHeartbeatAt: new Date(lastSchedulerHeartbeat).toISOString(),
      schedulerHealthy: true
    })
  }

  try {
    const result = await syncDifferential(reason)

    if (result.synced) {
      clearScheduledRetry()
      await updateLocalSyncState({
        lastRunAt: new Date().toISOString(),
        lastRunReason: reason,
        lastRunStatus: 'ok',
        lastRunError: '',
        retryCount: 0,
        nextRetryAt: '',
        ...(reason === 'interval' && {
          nextRunAt: new Date(Date.now() + AUTO_SYNC_INTERVAL_MS).toISOString()
        })
      })
      return result
    }

    return result
  } catch (error: unknown) {
    if (isAutoReason(reason) || reason === 'retry') {
      const currentState = (await readJsonSafe<SyncState>(getStateFilePath())) || {}
      const retryBackoffState = buildRetryBackoffState(currentState.retryCount || 0)

      await updateLocalSyncState({
        retryCount: retryBackoffState.retryCount,
        nextRetryAt: retryBackoffState.nextRetryAt,
        nextRunAt: retryBackoffState.nextRunAt
      })

      clearScheduledRetry()
      retrySyncTimeout = setTimeout(() => {
        executeSyncCycle('retry').catch(() => {
          notifySyncState(false)
        })
      }, retryBackoffState.delayMs)
    }

    throw error
  }
}

async function reconcileSyncData(): Promise<ReconcileResult> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  if (!config?.enabled || !config.workspaceId || !config.deviceName) {
    throw new Error('Config de sync inválida para reconciliación')
  }

  await ensureSyncDir()
  const prisma = getPrisma()

  let dbIndexed = 0
  await prisma.$transaction(async (tx) => {
    await tx.syncOutboxChange.deleteMany({
      where: {
        workspaceId: config.workspaceId,
        deviceId: config.deviceName,
        ackedAt: null
      }
    })

    for (const model of SNAPSHOT_MODELS) {
      const delegate = (tx as Record<string, unknown>)[model.delegateName] as
        | {
            findMany: () => Promise<Record<string, unknown>[]>
          }
        | undefined

      if (!delegate?.findMany) continue

      const rows = await delegate.findMany()
      for (const row of rows) {
        const id = row.id
        if (typeof id !== 'string' && typeof id !== 'number') continue

        const updatedAtValue = row.updatedAt
        const updatedAt =
          updatedAtValue instanceof Date
            ? updatedAtValue
            : new Date(typeof updatedAtValue === 'string' ? updatedAtValue : Date.now())

        await tx.syncOutboxChange.create({
          data: {
            workspaceId: config.workspaceId,
            deviceId: config.deviceName,
            tableName: model.modelName,
            recordId: String(id),
            operation: SyncOperation.UPDATE,
            payload: JSON.stringify(row),
            entityUpdatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
            deletedAt: null
          }
        })
        dbIndexed += 1
      }
    }
  })

  const mediaManifest = await buildLocalMediaManifest(config)
  await writeJson(getLocalMediaManifestPath(), mediaManifest)

  await updateLocalSyncState({
    lastRunAt: new Date().toISOString(),
    lastRunReason: 'manual-push',
    lastRunStatus: 'ok',
    lastRunError: ''
  })

  return {
    dbIndexed,
    mediaIndexed: mediaManifest.entries.length,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName
  }
}

export function initializeGoogleDriveSyncManager() {
  lastSchedulerHeartbeat = Date.now()
  updateLocalSyncState({
    nextRunAt: new Date(Date.now() + AUTO_SYNC_INTERVAL_MS).toISOString(),
    schedulerHealthy: true,
    lastSchedulerHeartbeatAt: new Date(lastSchedulerHeartbeat).toISOString()
  }).catch(() => {})

  executeSyncCycle('startup').catch(() => {
    notifySyncState(false)
  })

  if (autoSyncInterval) {
    clearInterval(autoSyncInterval)
  }
  if (schedulerHealthInterval) {
    clearInterval(schedulerHealthInterval)
  }
  clearScheduledRetry()

  autoSyncInterval = setInterval(() => {
    executeSyncCycle('interval').catch(() => {
      notifySyncState(false)
    })
  }, AUTO_SYNC_INTERVAL_MS)

  schedulerHealthInterval = setInterval(() => {
    const lag = Date.now() - lastSchedulerHeartbeat
    const healthy = lag <= SCHEDULER_STALE_THRESHOLD_MS
    updateLocalSyncState({
      schedulerHealthy: healthy,
      lastSchedulerHeartbeatAt: new Date(lastSchedulerHeartbeat).toISOString()
    }).catch(() => {})
  }, HEALTH_CHECK_INTERVAL_MS)

  ipcMain.handle('sync:google-drive:status', async () => {
    return await getGoogleDriveSyncStatus()
  })

  ipcMain.handle('sync:google-drive:configure', async (_event, config: GoogleDriveSyncConfig) => {
    return await configureGoogleDrive(config)
  })

  ipcMain.handle('sync:google-drive:connect', async (_event, config: GoogleDriveSyncConfig) => {
    notifySyncState(true)
    try {
      return await connectGoogleDrive(config)
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:disconnect', async () => {
    return await disconnectGoogleDrive()
  })

  ipcMain.handle('sync:google-drive:push', async () => {
    notifySyncState(true)
    try {
      return await executeSyncCycle('manual-push')
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:pull', async () => {
    notifySyncState(true)
    try {
      return await executeSyncCycle('manual-pull')
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:reconcile', async () => {
    notifySyncState(true)
    try {
      return await reconcileSyncData()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.on('sync:google-drive:auto-save-event', () => {
    executeSyncCycle('save').catch(() => {
      notifySyncState(false)
    })
  })

  app.on('before-quit', () => {
    executeSyncCycle('close').catch(() => {
      notifySyncState(false)
    })
  })
}
