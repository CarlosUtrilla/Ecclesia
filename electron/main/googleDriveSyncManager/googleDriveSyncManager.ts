import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs-extra'
import path from 'path'
import http from 'http'
import os from 'os'
import { createHash, randomUUID } from 'crypto'
import { google } from 'googleapis'
import log from 'electron-log'
import SyncService from '../../../database/controllers/sync/sync.service'
import { getPrisma, setOnOutboxWriteCallback, setOnMediaChangeCallback } from '../prisma'
import { getBiblesResourcesPath } from '../bibleManager/bibleManager'

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
  deviceName?: string
  appInstanceId?: string
  systemHostname?: string
  lastSyncAt?: string
  syncing?: boolean
  progress?: number
  conflictDetected?: boolean
  remoteModifiedAt?: string
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

// --- Snapshot (nuevo sistema de sync basado en instantáneas completas) ---
type SnapshotFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  tables: Record<string, unknown[]>
}

// --- Media manifest ---
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

// --- Bible manifest ---
type BibleManifestEntry = {
  fileName: string
  size: number
  checksum: string
  mtime: number
  deletedAt?: string | null
  lastSyncedAt?: string | null
}

type BibleManifestFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  entries: BibleManifestEntry[]
}

type ReconcileResult = {
  dbIndexed: number
  mediaIndexed: number
  biblesIndexed: number
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
// Snapshot (nuevo sistema, reemplaza diff-changes)
const SNAPSHOT_SCHEMA_VERSION = 1
const REMOTE_SNAPSHOT_FILE_PREFIX = 'ecclesia-snapshot'
// Media blobs
const LOCAL_MEDIA_MANIFEST_FILE_NAME = 'media-manifest.json'
const MEDIA_MANIFEST_SCHEMA_VERSION = 1
const REMOTE_MEDIA_MANIFEST_FILE_PREFIX = 'ecclesia-media-manifest'
const REMOTE_MEDIA_BLOB_FILE_PREFIX = 'ecclesia-media-blob'
// Bible blobs
const LOCAL_BIBLE_MANIFEST_FILE_NAME = 'bible-manifest.json'
const BIBLE_MANIFEST_SCHEMA_VERSION = 1
const REMOTE_BIBLE_MANIFEST_FILE_PREFIX = 'ecclesia-bible-manifest'
const REMOTE_BIBLE_BLOB_FILE_PREFIX = 'ecclesia-bible-blob'
// UUID único por instalación de la app: se genera la primera vez y persiste en userData/sync/
// Evita colisiones cuando dos instancias corren en el mismo equipo (mismo hostname)
const APP_INSTANCE_ID_FILE_NAME = 'app-instance-id.json'

const GOOGLE_REDIRECT_PORT = 53682
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000
const RETRY_BASE_DELAY_MS = 30 * 1000
const RETRY_MAX_DELAY_MS = 10 * 60 * 1000
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000
const SCHEDULER_STALE_THRESHOLD_MS = AUTO_SYNC_INTERVAL_MS * 2 + 30 * 1000

// Orden topológico: las tablas con FK dependencies van después de sus dependencias.
// TagSongs → Song → Lyrics (FK: Song, TagSongs)
// BiblePresentationSettings → Media → Themes (FK: Media?, BiblePresentationSettings?)
// Schedule → ScheduleItem (FK: Schedule)
// SelectedScreens → StageScreenConfig (FK: SelectedScreens, Themes?)
const SNAPSHOT_MODELS: SnapshotModelDefinition[] = [
  { modelName: 'TagSongs', delegateName: 'tagSongs' },
  { modelName: 'Song', delegateName: 'song' },
  { modelName: 'Lyrics', delegateName: 'lyrics' },
  { modelName: 'Font', delegateName: 'font' },
  // BibleSchema y BibleVerses son datos de referencia (contenido bíblico importado por dispositivo),
  // no datos de usuario. Se excluyen del sync diferencial.
  { modelName: 'BiblePresentationSettings', delegateName: 'biblePresentationSettings' },
  { modelName: 'Media', delegateName: 'media' },
  { modelName: 'Themes', delegateName: 'themes' },
  { modelName: 'Setting', delegateName: 'setting' },
  { modelName: 'Presentation', delegateName: 'presentation' },
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
let microPushTimer: ReturnType<typeof setTimeout> | null = null
let mediaMicroPushTimer: ReturnType<typeof setTimeout> | null = null

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

function getAppInstanceIdFilePath() {
  // En desarrollo, guardar en la raíz del proyecto para diferenciarlo del build.
  // Así dos instancias (dev + build) en la misma máquina tienen UUIDs distintos.
  if (!app.isPackaged) {
    try {
      const appPath =
        typeof (app as any).getAppPath === 'function' ? app.getAppPath() : getSyncDir()
      return path.join(appPath, `.dev-${APP_INSTANCE_ID_FILE_NAME}`)
    } catch {
      return path.join(getSyncDir(), `.dev-${APP_INSTANCE_ID_FILE_NAME}`)
    }
  }
  return path.join(getSyncDir(), APP_INSTANCE_ID_FILE_NAME)
}

let cachedAppInstanceId: string | null = null

/**
 * Lee o genera un UUID persistido por instalación de la app.
 * Independiente del hostname: permite sincronizar dos instancias en el mismo equipo.
 */
async function getOrCreateAppInstanceId(): Promise<string> {
  if (cachedAppInstanceId) return cachedAppInstanceId
  const filePath = getAppInstanceIdFilePath()
  const existing = await readJsonSafe<{ id: string }>(filePath)
  if (existing?.id && typeof existing.id === 'string' && existing.id.length > 8) {
    cachedAppInstanceId = existing.id
    return cachedAppInstanceId
  }
  if (app.isPackaged) await ensureSyncDir()
  const newId = randomUUID()
  await writeJson(filePath, { id: newId })
  cachedAppInstanceId = newId
  return cachedAppInstanceId
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
    deviceName: config.deviceName || os.hostname() || 'Este dispositivo',
    conflictStrategy: config.conflictStrategy || 'lastWriteWins',
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

// --- Snapshot helpers ---
function getSnapshotFileName(workspaceId: string, deviceId: string) {
  return `${REMOTE_SNAPSHOT_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${toSafeFileSegment(deviceId)}.json`
}

// --- Media helpers ---
function getRemoteMediaManifestFileName(workspaceId?: string) {
  return `${REMOTE_MEDIA_MANIFEST_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}.json`
}

function getRemoteMediaBlobFileName(workspaceId: string, checksum: string) {
  return `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${checksum}.bin`
}

// --- Bible helpers ---
function getRemoteBibleManifestFileName(workspaceId?: string) {
  return `${REMOTE_BIBLE_MANIFEST_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}.json`
}

function getRemoteBibleBlobFileName(workspaceId: string, checksum: string) {
  return `${REMOTE_BIBLE_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${checksum}.bin`
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

// --- Snapshot validator ---
function isValidSnapshotFile(value: unknown, expectedWorkspaceId: string): value is SnapshotFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SnapshotFile>
  if (candidate.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return false
  if (candidate.workspaceId !== expectedWorkspaceId) return false
  if (typeof candidate.deviceId !== 'string' || candidate.deviceId.length === 0) return false
  if (typeof candidate.updatedAt !== 'string' || Number.isNaN(Date.parse(candidate.updatedAt))) {
    return false
  }
  if (
    !candidate.tables ||
    typeof candidate.tables !== 'object' ||
    Array.isArray(candidate.tables)
  ) {
    return false
  }
  return true
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

async function buildLocalMediaManifest(
  config: PersistedSyncConfig,
  appInstanceId: string
): Promise<MediaManifestFile> {
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

  // Incluir archivos de fuentes custom: se almacenan en userData/media/fonts/{fileName}
  // y el campo filePath del modelo Font es relativo a userData/media/ (p.ej: 'fonts/MyFont.ttf')
  // Algunos entornos de test mockean `getPrisma()` sin el delegate `font`.
  const fontRows =
    prisma && (prisma as any).font && typeof (prisma as any).font.findMany === 'function'
      ? await (prisma as any).font.findMany({ select: { filePath: true } })
      : []

  const relativePathsSet = new Set<string>()
  for (const row of mediaRows) {
    if (row.filePath) relativePathsSet.add(row.filePath)
    if (row.thumbnail) relativePathsSet.add(row.thumbnail)
    if (row.fallback) relativePathsSet.add(row.fallback)
  }
  for (const row of fontRows) {
    if (row.filePath) relativePathsSet.add(row.filePath)
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

    // Solo marcar como eliminado si el archivo ya no existe en disco.
    // Si el archivo sigue en disco (ej: esta instancia tiene una BD diferente o incompleta),
    // conservar la entrada sin marcarla como deletedAt para no corromper el manifest remoto.
    const orphanFullPath = path.join(userMediaBase, relativePath)
    if (await fs.pathExists(orphanFullPath)) {
      nextEntriesMap.set(relativePath, previous)
    } else {
      nextEntriesMap.set(relativePath, {
        ...previous,
        deletedAt: previous.deletedAt || new Date().toISOString()
      })
    }
  }

  return {
    schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
    updatedAt: new Date().toISOString(),
    entries: Array.from(nextEntriesMap.values()).sort((a, b) => a.path.localeCompare(b.path))
  }
}

const DRIVE_FOLDER_NAME = 'Ecclesia'
let cachedDriveFolderId: string | null = null
let folderCreationPromise: Promise<string> | null = null

async function getOrCreateEcclesiaFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (cachedDriveFolderId) return cachedDriveFolderId
  if (folderCreationPromise) return folderCreationPromise

  folderCreationPromise = (async () => {
    const search = await drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed = false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1
    })

    if (search.data.files?.[0]?.id) {
      cachedDriveFolderId = search.data.files[0].id
      return cachedDriveFolderId
    }

    const created = await drive.files.create({
      requestBody: {
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    })

    cachedDriveFolderId = created.data.id!
    return cachedDriveFolderId
  })().finally(() => {
    folderCreationPromise = null
  })

  return folderCreationPromise
}

async function getRemoteMediaManifestMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
) {
  const fileName = getRemoteMediaManifestFileName(workspaceId)
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
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
      parents: [await getOrCreateEcclesiaFolder(drive)]
    },
    media,
    fields: 'id, modifiedTime'
  })
}

async function listRemoteMediaBlobs(drive: ReturnType<typeof google.drive>, workspaceId: string) {
  const prefix = `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-`
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name contains '${prefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
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
      parents: [await getOrCreateEcclesiaFolder(drive)]
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

  // Persiste el token renovado en disco cuando google-auth-library lo actualiza.
  // Si el cliente OAuth mockeado en tests no implementa `on`, evitar llamar para
  // no romper pruebas unitarias.
  try {
    if (typeof (oauthClient as any).on === 'function') {
      ;(oauthClient as any).on('tokens', async (newTokens: any) => {
        try {
          const current = (await readJsonSafe<Record<string, unknown>>(getTokenFilePath())) || {}
          await writeJson(getTokenFilePath(), { ...current, ...newTokens })
        } catch {
          // No fatal: el token sigue funcionando en memoria durante esta sesión
        }
      })
    }
  } catch {
    // Silenciar cualquier error en environments de test
  }

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

  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name='${manifestFileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    orderBy: 'modifiedTime desc'
  })

  return result.data.files?.[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT: nuevo sistema de sync por instantáneas completas de la BD
// Reemplaza el sistema outbox/inbox de cambios diferenciales.
// ─────────────────────────────────────────────────────────────────────────────

async function getSnapshotFileMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  deviceId: string
) {
  const fileName = getSnapshotFileName(workspaceId, deviceId)
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1
  })
  return result.data.files?.[0]
}

/** Exporta todos los registros de SNAPSHOT_MODELS a un objeto JSON listo para subir. */
async function buildSnapshot(
  config: PersistedSyncConfig,
  appInstanceId: string
): Promise<SnapshotFile> {
  const prisma = getPrisma()
  const tables: Record<string, unknown[]> = {}

  for (const model of SNAPSHOT_MODELS) {
    const delegate = (prisma as Record<string, unknown>)[model.delegateName] as
      | { findMany: () => Promise<unknown[]> }
      | undefined
    if (!delegate?.findMany) continue
    tables[model.modelName] = await delegate.findMany()
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
    updatedAt: new Date().toISOString(),
    tables
  }
}

/** Sube el snapshot de este dispositivo a Drive, sobreescribiendo el anterior. */
async function uploadSnapshot(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  snapshot: SnapshotFile
) {
  const fileName = getSnapshotFileName(config.workspaceId, snapshot.deviceId)
  const existing = await getSnapshotFileMetadata(drive, config.workspaceId, snapshot.deviceId)

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(snapshot)
  }

  if (existing?.id) {
    await drive.files.update({ fileId: existing.id, media, fields: 'id' })
    return
  }

  await drive.files.create({
    requestBody: { name: fileName, parents: [await getOrCreateEcclesiaFolder(drive)] },
    media,
    fields: 'id'
  })
}

/** Lista todos los snapshots del workspace en Drive. */
async function listAllRemoteSnapshotFiles(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
) {
  const prefix = `${REMOTE_SNAPSHOT_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-`
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name contains '${prefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 100
  })
  return result.data.files || []
}

/**
 * Descarga todos los snapshots de OTROS dispositivos y aplica las filas más
 * recientes a la BD local (lastWriteWins por updatedAt por registro).
 */
async function pullAllRemoteSnapshots(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  syncService: SyncService,
  appInstanceId: string
) {
  const files = await listAllRemoteSnapshotFiles(drive, config.workspaceId)
  const myDeviceSegment = toSafeFileSegment(appInstanceId)

  let devicesProcessed = 0
  let totalApplied = 0
  let totalStale = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const fileMeta of files) {
    const fileName = fileMeta.name || ''
    const expectedPrefix = `${REMOTE_SNAPSHOT_FILE_PREFIX}-${toSafeFileSegment(config.workspaceId)}-`
    if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue

    const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
    if (!deviceSegment || deviceSegment === myDeviceSegment) continue

    try {
      const response = await drive.files.get(
        { fileId: fileMeta.id || '', alt: 'media' },
        { responseType: 'stream' }
      )
      const raw = await streamToString(response.data as NodeJS.ReadableStream)

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (parseErr) {
        log.error(`[sync] Error al parsear snapshot ${fileName}:`, parseErr)
        continue
      }

      if (!isValidSnapshotFile(parsed, config.workspaceId)) {
        log.warn(`[sync] Snapshot inválido o workspaceId no coincide: ${fileName}`)
        continue
      }
      if (parsed.deviceId === appInstanceId) continue

      const result = await syncService.applySnapshotRows(parsed.tables)
      totalApplied += result.applied
      totalStale += result.stale
      totalSkipped += result.skipped
      totalFailed += result.failed
      devicesProcessed += 1
    } catch (err) {
      log.error(`[sync] Error procesando snapshot ${fileName}:`, err)
    }
  }

  return {
    devicesProcessed,
    applied: totalApplied,
    stale: totalStale,
    skipped: totalSkipped,
    failed: totalFailed
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BIBLE SYNC: sincroniza biblias importadas por el usuario (archivos .ebbl)
// Solo se sincronizan las biblias que NO vienen incluidas en el bundle del app.
// ─────────────────────────────────────────────────────────────────────────────

function getLocalBibleManifestPath() {
  return path.join(getSyncDir(), LOCAL_BIBLE_MANIFEST_FILE_NAME)
}

async function buildLocalBibleManifest(
  config: PersistedSyncConfig,
  appInstanceId: string
): Promise<BibleManifestFile> {
  const userBiblesDir = path.join(app.getPath('userData'), 'bibles')
  const existing = await readJsonSafe<BibleManifestFile>(getLocalBibleManifestPath())
  const existingByName = new Map(
    (existing?.entries || []).map((entry) => [entry.fileName, entry] as const)
  )

  // Obtener nombres de biblias incluidas en el bundle (no se sincronizan)
  const builtInNames = new Set<string>()
  try {
    const builtInDir = getBiblesResourcesPath()
    if (await fs.pathExists(builtInDir)) {
      const files = await fs.readdir(builtInDir)
      for (const f of files) {
        if (f.endsWith('.ebbl')) builtInNames.add(f)
      }
    }
  } catch {
    // Si no se puede leer el directorio de recursos, continuar sin filtrar
  }

  const entries: BibleManifestEntry[] = []

  if (await fs.pathExists(userBiblesDir)) {
    const files = await fs.readdir(userBiblesDir)
    for (const fileName of files) {
      if (!fileName.endsWith('.ebbl')) continue
      if (builtInNames.has(fileName)) continue // Las biblias del bundle no se sincronizan

      const fullPath = path.join(userBiblesDir, fileName)
      const stats = await fs.stat(fullPath)
      if (!stats.isFile()) continue

      const checksum = await computeFileChecksum(fullPath)
      const previous = existingByName.get(fileName)

      entries.push({
        fileName,
        size: stats.size,
        checksum,
        mtime: stats.mtimeMs,
        deletedAt: null,
        lastSyncedAt: previous?.lastSyncedAt || null
      })
    }
  }

  return {
    schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
    updatedAt: new Date().toISOString(),
    entries
  }
}

function isValidBibleManifestEntry(value: unknown): value is BibleManifestEntry {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<BibleManifestEntry>
  if (typeof c.fileName !== 'string' || c.fileName.length === 0) return false
  if (typeof c.size !== 'number' || !Number.isFinite(c.size) || c.size < 0) return false
  if (typeof c.checksum !== 'string' || c.checksum.length === 0) return false
  if (typeof c.mtime !== 'number' || !Number.isFinite(c.mtime) || c.mtime < 0) return false
  return true
}

function isValidBibleManifestFile(
  value: unknown,
  expectedWorkspaceId: string
): value is BibleManifestFile {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<BibleManifestFile>
  if (c.schemaVersion !== BIBLE_MANIFEST_SCHEMA_VERSION) return false
  if (c.workspaceId !== expectedWorkspaceId) return false
  if (typeof c.deviceId !== 'string' || c.deviceId.length === 0) return false
  if (typeof c.updatedAt !== 'string' || Number.isNaN(Date.parse(c.updatedAt))) return false
  if (!Array.isArray(c.entries)) return false
  return c.entries.every((e) => isValidBibleManifestEntry(e))
}

async function getRemoteBibleManifestMetadata(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
) {
  const fileName = getRemoteBibleManifestFileName(workspaceId)
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    orderBy: 'modifiedTime desc'
  })
  return result.data.files?.[0]
}

async function readRemoteBibleManifest(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string
): Promise<BibleManifestFile | null> {
  const metadata = await getRemoteBibleManifestMetadata(drive, workspaceId)
  if (!metadata?.id) return null

  const response = await drive.files.get(
    { fileId: metadata.id, alt: 'media' },
    { responseType: 'stream' }
  )
  const raw = await streamToString(response.data as NodeJS.ReadableStream)
  try {
    const parsed = JSON.parse(raw)
    return isValidBibleManifestFile(parsed, workspaceId) ? parsed : null
  } catch {
    return null
  }
}

async function writeRemoteBibleManifest(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  manifest: BibleManifestFile
) {
  const fileName = getRemoteBibleManifestFileName(workspaceId)
  const existing = await getRemoteBibleManifestMetadata(drive, workspaceId)
  const media = { mimeType: 'application/json', body: JSON.stringify(manifest) }

  if (existing?.id) {
    await drive.files.update({ fileId: existing.id, media, fields: 'id' })
    return
  }

  await drive.files.create({
    requestBody: { name: fileName, parents: [await getOrCreateEcclesiaFolder(drive)] },
    media,
    fields: 'id'
  })
}

async function listRemoteBibleBlobs(drive: ReturnType<typeof google.drive>, workspaceId: string) {
  const prefix = `${REMOTE_BIBLE_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-`
  const folderId = await getOrCreateEcclesiaFolder(drive)
  const result = await drive.files.list({
    q: `name contains '${prefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1000
  })

  const byChecksum = new Map<string, string>()
  for (const file of result.data.files || []) {
    const name = file.name || ''
    if (!name.startsWith(prefix) || !name.endsWith('.bin') || !file.id) continue
    const checksum = name.slice(prefix.length, -'.bin'.length)
    if (checksum) byChecksum.set(checksum, file.id)
  }
  return byChecksum
}

async function uploadBibleBlob(
  drive: ReturnType<typeof google.drive>,
  workspaceId: string,
  entry: BibleManifestEntry
) {
  const fullPath = path.join(app.getPath('userData'), 'bibles', entry.fileName)
  if (!(await fs.pathExists(fullPath))) {
    throw new Error(`Archivo de biblia no encontrado: ${entry.fileName}`)
  }

  const fileName = getRemoteBibleBlobFileName(workspaceId, entry.checksum)
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [await getOrCreateEcclesiaFolder(drive)] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(fullPath) },
    fields: 'id'
  })
  return created.data.id || ''
}

async function downloadBibleBlobToLocal(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
  fileName: string
) {
  const destination = path.join(app.getPath('userData'), 'bibles', fileName)
  await fs.ensureDir(path.dirname(destination))

  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destination)
    ;(response.data as NodeJS.ReadableStream).pipe(writer)
    writer.on('finish', () => resolve())
    writer.on('error', reject)
  })
}

async function syncBibleFiles(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  mode: 'push' | 'pull',
  appInstanceId: string
) {
  const localManifest = await buildLocalBibleManifest(config, appInstanceId)
  if (localManifest.entries.length === 0 && mode === 'push') {
    // Sin biblias importadas → nada que subir
    return { uploaded: 0, downloaded: 0 }
  }

  const remoteManifest = (await readRemoteBibleManifest(drive, config.workspaceId)) || {
    schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
    updatedAt: new Date().toISOString(),
    entries: []
  }

  const localByName = new Map(
    localManifest.entries.map((entry) => [entry.fileName, entry] as const)
  )
  const remoteByName = new Map(
    remoteManifest.entries.map((entry) => [entry.fileName, entry] as const)
  )

  const remoteBlobByChecksum = await listRemoteBibleBlobs(drive, config.workspaceId)
  let uploaded = 0
  let downloaded = 0
  const nowIso = new Date().toISOString()

  if (mode === 'push') {
    for (const localEntry of localManifest.entries) {
      if (localEntry.deletedAt) {
        remoteByName.set(localEntry.fileName, { ...localEntry, lastSyncedAt: nowIso })
        localByName.set(localEntry.fileName, { ...localEntry, lastSyncedAt: nowIso })
        continue
      }

      const remoteEntry = remoteByName.get(localEntry.fileName)
      if (remoteEntry?.checksum === localEntry.checksum && !remoteEntry.deletedAt) continue

      if (!remoteBlobByChecksum.has(localEntry.checksum)) {
        const fileId = await uploadBibleBlob(drive, config.workspaceId, localEntry)
        if (fileId) remoteBlobByChecksum.set(localEntry.checksum, fileId)
      }

      uploaded += 1
      localByName.set(localEntry.fileName, { ...localEntry, deletedAt: null, lastSyncedAt: nowIso })
      remoteByName.set(localEntry.fileName, {
        ...localEntry,
        deletedAt: null,
        lastSyncedAt: nowIso
      })
    }

    await writeRemoteBibleManifest(drive, config.workspaceId, {
      schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: nowIso,
      entries: Array.from(remoteByName.values()).sort((a, b) =>
        a.fileName.localeCompare(b.fileName)
      )
    })
  }

  if (mode === 'pull') {
    for (const remoteEntry of remoteManifest.entries) {
      if (remoteEntry.deletedAt) {
        const localFullPath = path.join(app.getPath('userData'), 'bibles', remoteEntry.fileName)
        if (await fs.pathExists(localFullPath)) await fs.remove(localFullPath)
        localByName.set(remoteEntry.fileName, { ...remoteEntry, lastSyncedAt: nowIso })
        continue
      }

      const localEntry = localByName.get(remoteEntry.fileName)
      if (localEntry?.checksum === remoteEntry.checksum && !localEntry.deletedAt) continue

      const remoteFileId = remoteBlobByChecksum.get(remoteEntry.checksum)
      if (!remoteFileId) continue

      await downloadBibleBlobToLocal(drive, remoteFileId, remoteEntry.fileName)
      downloaded += 1
      localByName.set(remoteEntry.fileName, {
        ...remoteEntry,
        deletedAt: null,
        lastSyncedAt: nowIso
      })
    }
  }

  await writeJson(getLocalBibleManifestPath(), {
    schemaVersion: BIBLE_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
    updatedAt: nowIso,
    entries: Array.from(localByName.values()).sort((a, b) => a.fileName.localeCompare(b.fileName))
  })

  return { uploaded, downloaded }
}

async function syncMediaManifest(
  drive: ReturnType<typeof google.drive>,
  config: PersistedSyncConfig,
  mode: 'push' | 'pull',
  appInstanceId: string
) {
  const localManifest = await buildLocalMediaManifest(config, appInstanceId)
  const remoteManifest = (await readRemoteMediaManifest(drive, config.workspaceId)) || {
    schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
    workspaceId: config.workspaceId,
    deviceId: appInstanceId,
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
    deviceId: appInstanceId,
    updatedAt: nowIso,
    entries: Array.from(localByPath.values()).sort((a, b) => a.path.localeCompare(b.path))
  }

  await writeJson(getLocalMediaManifestPath(), nextLocalManifest)

  if (mode === 'push') {
    const nextRemoteManifest: MediaManifestFile = {
      schemaVersion: MEDIA_MANIFEST_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
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
      parents: [await getOrCreateEcclesiaFolder(drive)]
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

  if (!config.workspaceId) config.workspaceId = 'default'
  if (!config.deviceName) config.deviceName = os.hostname() || 'Este dispositivo'

  const shouldRun =
    reason === 'retry' ||
    reason === 'manual-push' ||
    reason === 'manual-pull' ||
    reason === 'startup' ||
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

  if (config.conflictStrategy === 'primaryDevice' && config.primaryDeviceName) {
    if (config.deviceName !== config.primaryDeviceName) {
      notifySyncState(false)
      return { synced: false, reason, skipped: 'secondary-device' as const }
    }
  }

  notifySyncState(true, 10)

  try {
    const { drive } = await getDriveClient()
    const syncService = new SyncService()
    const appInstanceId = await getOrCreateAppInstanceId()

    // ── PULL: siempre, en cada ciclo ──────────────────────────────────────────
    // Descarga los snapshots de todos los demás dispositivos y aplica las filas
    // más recientes (lastWriteWins por updatedAt). Si no hay snapshots remotos
    // aún, la operación es un no-op seguro.
    notifySyncState(true, 20)
    const pullResult = await pullAllRemoteSnapshots(drive, config, syncService, appInstanceId)
    notifySyncState(true, 40)
    const pullMediaResult = await syncMediaManifest(drive, config, 'pull', appInstanceId)
    notifySyncState(true, 50)
    const pullBibleResult = await syncBibleFiles(drive, config, 'pull', appInstanceId)

    // Notificar al renderer que hay datos nuevos en la BD para que refetch las queries
    if (pullResult.applied > 0) {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('sync-data-applied', { applied: pullResult.applied })
      })
    }

    // ── PUSH: en todos los ciclos excepto manual-pull ────────────────────────
    let snapshotUploaded = false
    let pushMediaResult = { uploaded: 0 }
    let pushBibleResult = { uploaded: 0 }

    if (reason !== 'manual-pull') {
      notifySyncState(true, 60)
      const snapshot = await buildSnapshot(config, appInstanceId)
      await uploadSnapshot(drive, config, snapshot)
      snapshotUploaded = true
      notifySyncState(true, 75)
      pushMediaResult = await syncMediaManifest(drive, config, 'push', appInstanceId)
      notifySyncState(true, 85)
      pushBibleResult = await syncBibleFiles(drive, config, 'push', appInstanceId)
      notifySyncState(true, 92)
      await writeRemoteManifest(drive, config)
    }

    const syncedAt = new Date().toISOString()
    await updateLocalSyncState({
      lastSyncAt: syncedAt,
      lastRemoteModifiedAt: syncedAt,
      conflictDetected: false
    })

    notifySyncState(true, 100)
    return {
      synced: true,
      reason,
      syncedAt,
      devicesProcessed: pullResult.devicesProcessed,
      applied: pullResult.applied,
      stale: pullResult.stale,
      snapshotUploaded,
      mediaDownloaded: pullMediaResult.downloaded,
      mediaUploaded: pushMediaResult.uploaded,
      biblesDownloaded: pullBibleResult.downloaded,
      biblesUploaded: pushBibleResult.uploaded
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
    deviceName: config?.deviceName,
    appInstanceId: await getOrCreateAppInstanceId().catch(() => undefined),
    systemHostname: os.hostname(),
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
  // Guardamos sin enabled todavía; lo forzamos a true tras OAuth exitoso
  const persistedConfig: PersistedSyncConfig = {
    ...normalizedConfig,
    enabled: false,
    updatedAt: new Date().toISOString()
  }

  await writeJson(getConfigFilePath(), persistedConfig)

  const oauthClient = getOAuthClient()
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file']
  })

  const code = await captureGoogleAuthCode(authUrl)
  const tokenResult = await oauthClient.getToken(code)
  oauthClient.setCredentials(tokenResult.tokens)

  await writeJson(getTokenFilePath(), tokenResult.tokens)

  // OAuth exitoso → activar sync
  await writeJson(getConfigFilePath(), {
    ...persistedConfig,
    enabled: true,
    updatedAt: new Date().toISOString()
  })

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
  cachedDriveFolderId = null
  return { connected: false }
}

export async function applyPendingDriveRestoreOnStartup() {
  // El flujo de restore por ZIP fue removido durante la migración al sync diferencial.
  return false
}

async function configureGoogleDrive(config: GoogleDriveSyncConfig) {
  await ensureSyncDir()
  const normalizedConfig = normalizeConfig(config)

  // Si ya hay token en disco (usuario conectado), preservar enabled=true para no
  // desactivar el sync accidentalmente cuando la UI envía enabled:false por defecto.
  const existingConfig = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  const hasToken = await fs.pathExists(getTokenFilePath())
  const resolvedEnabled = hasToken && existingConfig?.enabled ? true : normalizedConfig.enabled

  const persistedConfig: PersistedSyncConfig = {
    ...normalizedConfig,
    enabled: resolvedEnabled,
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
  if (!config) {
    throw new Error('Config de sync inválida para reconciliación')
  }

  if (!config.workspaceId) config.workspaceId = 'default'
  if (!config.deviceName) config.deviceName = os.hostname() || 'Este dispositivo'

  await ensureSyncDir()

  const { drive } = await getDriveClient()
  const appInstanceId = await getOrCreateAppInstanceId()

  // Construir y subir snapshot completo de la BD
  const snapshot = await buildSnapshot(config, appInstanceId)
  await uploadSnapshot(drive, config, snapshot)

  const totalRows = Object.values(snapshot.tables).reduce(
    (acc, rows) => acc + (Array.isArray(rows) ? rows.length : 0),
    0
  )

  // Construir y guardar manifests locales de archivos
  const mediaManifest = await buildLocalMediaManifest(config, appInstanceId)
  await writeJson(getLocalMediaManifestPath(), mediaManifest)

  const bibleManifest = await buildLocalBibleManifest(config, appInstanceId)
  await writeJson(getLocalBibleManifestPath(), bibleManifest)

  await updateLocalSyncState({
    lastRunAt: new Date().toISOString(),
    lastRunReason: 'manual-push',
    lastRunStatus: 'ok',
    lastRunError: ''
  })

  return {
    dbIndexed: totalRows,
    mediaIndexed: mediaManifest.entries.length,
    biblesIndexed: bibleManifest.entries.length,
    workspaceId: config.workspaceId,
    deviceId: config.deviceName
  }
}

type RemoteSnapshotDeviceData = {
  deviceId: string
  updatedAt: string
  totalRows: number
  byTable: Record<string, number>
}

type RemoteDriveData = {
  fetchedAt: string
  workspaceId: string
  manifest: {
    deviceName: string
    updatedAt: string
    lastSyncAt: string
  } | null
  devices: RemoteSnapshotDeviceData[]
  media: {
    totalFiles: number
    activeFiles: number
    deletedFiles: number
    totalSizeBytes: number
    entries: Array<{
      path: string
      size: number
      checksum: string
      deletedAt: string | null
      lastSyncedAt: string | null
    }>
  } | null
  bibles: {
    totalFiles: number
    activeFiles: number
  } | null
}

async function getRemoteDriveData(): Promise<RemoteDriveData> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  if (!config) {
    throw new Error('No hay configuración de sync activa')
  }

  const { drive } = await getDriveClient()
  const fetchedAt = new Date().toISOString()

  // Manifest raíz
  const manifestMeta = await getRemoteManifestMetadata(drive, config.workspaceId)
  let manifest: RemoteDriveData['manifest'] = null
  if (manifestMeta?.id) {
    try {
      const response = await drive.files.get(
        { fileId: manifestMeta.id, alt: 'media' },
        { responseType: 'stream' }
      )
      const raw = await streamToString(response.data as NodeJS.ReadableStream)
      const parsed = JSON.parse(raw) as Partial<RemoteManifest>
      manifest = {
        deviceName: parsed.deviceName || '',
        updatedAt: parsed.updatedAt || '',
        lastSyncAt: parsed.lastSyncAt || ''
      }
    } catch {
      // manifest no disponible
    }
  }

  // Snapshots por dispositivo
  const snapshotFiles = await listAllRemoteSnapshotFiles(drive, config.workspaceId)
  const devices: RemoteSnapshotDeviceData[] = []

  for (const fileMeta of snapshotFiles) {
    const fileName = fileMeta.name || ''
    const expectedPrefix = `${REMOTE_SNAPSHOT_FILE_PREFIX}-${toSafeFileSegment(config.workspaceId)}-`
    if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue

    const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
    if (!deviceSegment) continue

    try {
      const response = await drive.files.get(
        { fileId: fileMeta.id || '', alt: 'media' },
        { responseType: 'stream' }
      )
      const raw = await streamToString(response.data as NodeJS.ReadableStream)
      const parsed = JSON.parse(raw) as Partial<SnapshotFile>

      if (!parsed.tables || typeof parsed.tables !== 'object') continue

      const byTable: Record<string, number> = {}
      let totalRows = 0
      for (const [table, rows] of Object.entries(parsed.tables)) {
        if (Array.isArray(rows)) {
          byTable[table] = rows.length
          totalRows += rows.length
        }
      }

      devices.push({
        deviceId: parsed.deviceId || deviceSegment,
        updatedAt: parsed.updatedAt || fileMeta.modifiedTime || '',
        totalRows,
        byTable
      })
    } catch {
      // saltar dispositivo con error
    }
  }

  // Media manifest
  let media: RemoteDriveData['media'] = null
  const remoteMedia = await readRemoteMediaManifest(drive, config.workspaceId)
  if (remoteMedia) {
    const activeEntries = remoteMedia.entries.filter((e) => !e.deletedAt)
    const deletedEntries = remoteMedia.entries.filter((e) => e.deletedAt)
    media = {
      totalFiles: remoteMedia.entries.length,
      activeFiles: activeEntries.length,
      deletedFiles: deletedEntries.length,
      totalSizeBytes: activeEntries.reduce((acc, e) => acc + e.size, 0),
      entries: remoteMedia.entries.map((e) => ({
        path: e.path,
        size: e.size,
        checksum: e.checksum.slice(0, 12) + '…',
        deletedAt: e.deletedAt ?? null,
        lastSyncedAt: e.lastSyncedAt ?? null
      }))
    }
  }

  // Bible manifest
  let bibles: RemoteDriveData['bibles'] = null
  const remoteBibles = await readRemoteBibleManifest(drive, config.workspaceId)
  if (remoteBibles) {
    bibles = {
      totalFiles: remoteBibles.entries.length,
      activeFiles: remoteBibles.entries.filter((e) => !e.deletedAt).length
    }
  }

  return {
    fetchedAt,
    workspaceId: config.workspaceId,
    manifest,
    devices,
    media,
    bibles
  }
}

async function pushSnapshotOnly(): Promise<void> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  if (!config?.enabled) return
  const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
  if (!token) return
  if (isSyncing) return
  if (!config.workspaceId) config.workspaceId = 'default'
  if (!config.deviceName) config.deviceName = os.hostname() || 'Este dispositivo'
  try {
    const { drive } = await getDriveClient()
    const appInstanceId = await getOrCreateAppInstanceId()
    const snapshot = await buildSnapshot(config, appInstanceId)
    await uploadSnapshot(drive, config, snapshot)
  } catch (err) {
    log.error('[sync] pushSnapshotOnly falló:', err)
  }
}

async function pushMediaOnly(): Promise<void> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  if (!config?.enabled) return
  const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
  if (!token) return
  if (isSyncing) return
  if (!config.workspaceId) config.workspaceId = 'default'
  if (!config.deviceName) config.deviceName = os.hostname() || 'Este dispositivo'
  try {
    const { drive } = await getDriveClient()
    const appInstanceId = await getOrCreateAppInstanceId()
    await syncMediaManifest(drive, config, 'push', appInstanceId)
  } catch (err) {
    log.error('[sync] pushMediaOnly falló:', err)
  }
}

export function scheduleMicroPush(): void {
  if (microPushTimer) clearTimeout(microPushTimer)
  microPushTimer = setTimeout(() => {
    microPushTimer = null
    pushSnapshotOnly().catch(() => {})
  }, 1000)
}

export function scheduleMicroMediaPush(): void {
  if (mediaMicroPushTimer) clearTimeout(mediaMicroPushTimer)
  mediaMicroPushTimer = setTimeout(() => {
    mediaMicroPushTimer = null
    pushMediaOnly().catch(() => {})
  }, 1000)
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
    return await executeSyncCycle('manual-push')
  })

  ipcMain.handle('sync:google-drive:pull', async () => {
    return await executeSyncCycle('manual-pull')
  })

  ipcMain.handle('sync:google-drive:reconcile', async () => {
    notifySyncState(true)
    try {
      return await reconcileSyncData()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:remote-data', async () => {
    return await getRemoteDriveData()
  })

  // Registrar micro-push en el middleware de Prisma
  setOnOutboxWriteCallback(() => scheduleMicroPush())
  // Al cambiar Media/Font: subir el archivo Y el snapshot (el registro de BD con la URL del medio)
  setOnMediaChangeCallback(() => {
    scheduleMicroMediaPush()
    scheduleMicroPush()
  })

  ipcMain.on('sync:google-drive:auto-save-event', () => {
    scheduleMicroPush()
  })

  ipcMain.handle('sync:google-drive:micro-push-media', () => {
    scheduleMicroMediaPush()
  })

  app.on('before-quit', () => {
    executeSyncCycle('close').catch(() => {
      notifySyncState(false)
    })
  })
}
