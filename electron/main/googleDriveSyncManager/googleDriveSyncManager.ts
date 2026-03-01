import { app, ipcMain } from 'electron'
import fs from 'fs-extra'
import path from 'path'
import http from 'http'
import archiver from 'archiver'
import unzipper from 'unzipper'
import { google } from 'googleapis'
import { BrowserWindow } from 'electron'
import { initPrisma } from '../prisma'

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

type PendingRestoreManifest = {
  zipPath: string
  downloadedAt: string
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
}

const SYNC_DIR_NAME = 'sync'
const CONFIG_FILE_NAME = 'google-drive-config.json'
const TOKEN_FILE_NAME = 'google-drive-token.json'
const STATE_FILE_NAME = 'google-drive-state.json'
const PENDING_RESTORE_FILE_NAME = 'pending-restore.json'
const PENDING_ZIP_FILE_NAME = 'pending-restore.zip'
const BACKUP_FILE_PREFIX = 'ecclesia-backup'
const GOOGLE_REDIRECT_PORT = 53682

let isSyncing = false
let syncProgress = 0
let autoSyncInterval: NodeJS.Timeout | null = null

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

function getPendingRestoreFilePath() {
  return path.join(getSyncDir(), PENDING_RESTORE_FILE_NAME)
}

function getPendingZipFilePath() {
  return path.join(getSyncDir(), PENDING_ZIP_FILE_NAME)
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

function getBackupFileName(workspaceId?: string) {
  const normalizedWorkspace = workspaceId?.trim() || 'default'
  return `${BACKUP_FILE_PREFIX}-${normalizedWorkspace}.zip`
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
  const tokens = await readJsonSafe<any>(getTokenFilePath())

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

async function getRemoteBackupMetadata(
  drive: ReturnType<typeof google.drive>,
  config: GoogleDriveSyncConfig
) {
  const rootFolderId = await ensureDriveFolder(drive, 'Ecclesia Sync')
  const workspaceFolderName = config.workspaceId?.trim() || 'default'
  const workspaceFolderId = await ensureDriveFolder(drive, workspaceFolderName, rootFolderId)
  const backupFileName = getBackupFileName(config.workspaceId)

  const backupResult = await drive.files.list({
    q: `name='${backupFileName.replace(/'/g, "\\'")}' and '${workspaceFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    pageSize: 1,
    spaces: 'drive',
    orderBy: 'modifiedTime desc'
  })

  return backupResult.data.files?.[0]
}

async function ensureDriveFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
) {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : ''
  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${name.replace(/'/g, "\\'")}'${parentQuery}`

  const existing = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1,
    spaces: 'drive'
  })

  const folder = existing.data.files?.[0]
  if (folder?.id) {
    return folder.id
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    },
    fields: 'id'
  })

  if (!created.data.id) {
    throw new Error('No se pudo crear carpeta en Google Drive')
  }

  return created.data.id
}

async function createBackupZipFile(targetZipPath: string) {
  const userDataPath = app.getPath('userData')

  await fs.remove(targetZipPath)
  await fs.ensureDir(path.dirname(targetZipPath))

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(targetZipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    output.on('error', (error) => reject(error))
    archive.on('error', (error) => reject(error))

    archive.pipe(output)
    archive.glob('**/*', {
      cwd: userDataPath,
      dot: true,
      ignore: [
        `${SYNC_DIR_NAME}/**`,
        'backups/**',
        'Cache/**',
        'Code Cache/**',
        'GPUCache/**',
        'logs/**'
      ]
    })

    archive.finalize()
  })
}

async function uploadBackupToDrive() {
  notifySyncState(true, 10)
  const { drive, config } = await getDriveClient()

  const rootFolderId = await ensureDriveFolder(drive, 'Ecclesia Sync')
  const workspaceFolderName = config.workspaceId?.trim() || 'default'
  const workspaceFolderId = await ensureDriveFolder(drive, workspaceFolderName, rootFolderId)

  const backupFileName = getBackupFileName(config.workspaceId)
  const tempZipPath = path.join(getSyncDir(), `upload-${backupFileName}`)

  notifySyncState(true, 25)
  await createBackupZipFile(tempZipPath)
  notifySyncState(true, 40)

  const existing = await drive.files.list({
    q: `name='${backupFileName.replace(/'/g, "\\'")}' and '${workspaceFolderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    spaces: 'drive'
  })

  const existingFile = existing.data.files?.[0]

  const zipStats = await fs.stat(tempZipPath)
  const totalBytes = zipStats.size || 1
  let uploadedBytes = 0
  const uploadStream = fs.createReadStream(tempZipPath)

  uploadStream.on('data', (chunk: string | Buffer) => {
    uploadedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
    const uploadProgress = 45 + (uploadedBytes / totalBytes) * 45
    notifySyncState(true, uploadProgress)
  })

  const media = {
    mimeType: 'application/zip',
    body: uploadStream
  }

  let fileId = existingFile?.id
  if (fileId) {
    await drive.files.update({ fileId, media })
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: backupFileName,
        parents: [workspaceFolderId]
      },
      media,
      fields: 'id'
    })
    fileId = created.data.id || undefined
  }

  notifySyncState(true, 95)

  await fs.remove(tempZipPath)

  const state = (await readJsonSafe<Record<string, string>>(getStateFilePath())) || {}
  state.lastSyncAt = new Date().toISOString()
  await writeJson(getStateFilePath(), state)

  notifySyncState(true, 100)

  return {
    fileId,
    fileName: backupFileName,
    workspace: workspaceFolderName,
    syncedAt: state.lastSyncAt
  }
}

async function downloadBackupAndQueueRestore() {
  notifySyncState(true, 10)
  const { drive, config } = await getDriveClient()

  const backupFile = await getRemoteBackupMetadata(drive, config)
  const backupFileName = getBackupFileName(config.workspaceId)
  if (!backupFile?.id) {
    throw new Error('No se encontró respaldo en Google Drive para este workspace')
  }

  notifySyncState(true, 20)

  await ensureSyncDir()
  const pendingZipPath = getPendingZipFilePath()
  await fs.remove(pendingZipPath)

  const response = await drive.files.get(
    {
      fileId: backupFile.id,
      alt: 'media'
    },
    { responseType: 'stream' }
  )

  const totalBytesHeader = Number(response.headers?.['content-length'] || 0)
  const totalBytes = totalBytesHeader > 0 ? totalBytesHeader : null
  let downloadedBytes = 0

  await new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(pendingZipPath)
    response.data.on('error', (error: Error) => reject(error))
    response.data.on('data', (chunk: string | Buffer) => {
      if (!totalBytes) {
        notifySyncState(true, 55)
        return
      }
      downloadedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      const downloadProgress = 25 + (downloadedBytes / totalBytes) * 55
      notifySyncState(true, downloadProgress)
    })
    writeStream.on('error', (error) => reject(error))
    writeStream.on('finish', () => {
      notifySyncState(true, 82)
      resolve()
    })
    response.data.pipe(writeStream)
  })

  const manifest: PendingRestoreManifest = {
    zipPath: pendingZipPath,
    downloadedAt: new Date().toISOString()
  }

  await writeJson(getPendingRestoreFilePath(), manifest)

  notifySyncState(true, 90)

  return {
    queued: true,
    requiresRestart: true,
    backupFileName,
    downloadedAt: manifest.downloadedAt
  }
}

async function applyDownloadedBackupImmediately(zipPath: string) {
  notifySyncState(true, 92)
  const syncDir = getSyncDir()
  const tempExtractDir = path.join(syncDir, 'restore-temp-live')
  const userDataDir = app.getPath('userData')

  await fs.remove(tempExtractDir)
  await fs.ensureDir(tempExtractDir)

  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: tempExtractDir }))
    .promise()

  const children = await fs.readdir(tempExtractDir)
  let processedChildren = 0
  const totalChildren = children.length || 1

  for (const child of children) {
    if (child === SYNC_DIR_NAME) {
      continue
    }
    const sourcePath = path.join(tempExtractDir, child)
    const targetPath = path.join(userDataDir, child)
    await fs.remove(targetPath)
    await fs.copy(sourcePath, targetPath, { overwrite: true })
    processedChildren += 1
    const restoreProgress = 93 + (processedChildren / totalChildren) * 5
    notifySyncState(true, restoreProgress)
  }

  await fs.remove(tempExtractDir)
  await fs.remove(zipPath)

  await initPrisma()
  notifySyncState(true, 99)

  const refreshEvents = [
    'theme-saved',
    'tags-saved',
    'song-saved',
    'schedule-group-templates-saved'
  ]
  BrowserWindow.getAllWindows().forEach((win) => {
    refreshEvents.forEach((eventName) => win.webContents.send(eventName))
  })
}

async function downloadBackupAndApplyImmediately() {
  const result = await downloadBackupAndQueueRestore()
  const manifest = await readJsonSafe<PendingRestoreManifest>(getPendingRestoreFilePath())
  if (!manifest?.zipPath || !(await fs.pathExists(manifest.zipPath))) {
    throw new Error('No se pudo preparar el respaldo para restauración en caliente')
  }

  await applyDownloadedBackupImmediately(manifest.zipPath)
  await fs.remove(getPendingRestoreFilePath())

  notifySyncState(true, 100)

  return {
    ...result,
    queued: false,
    requiresRestart: false,
    appliedInRuntime: true
  }
}

async function getGoogleDriveSyncStatus(): Promise<SyncStatus> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
  const state = await readJsonSafe<Record<string, string>>(getStateFilePath())
  const pendingRestore = await fs.pathExists(getPendingRestoreFilePath())

  const status: SyncStatus = {
    connected: Boolean(config && token),
    pendingRestore,
    workspaceId: config?.workspaceId,
    lastSyncAt: state?.lastSyncAt,
    syncing: isSyncing,
    progress: isSyncing ? syncProgress : 0
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

    const remote = await getRemoteBackupMetadata(drive, config)
    status.remoteModifiedAt = remote?.modifiedTime || undefined
    if (remote?.modifiedTime && state?.lastSyncAt && remote.modifiedTime > state.lastSyncAt) {
      status.conflictDetected = true
    }
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
    scope: ['https://www.googleapis.com/auth/drive.file']
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
  const manifest = await readJsonSafe<PendingRestoreManifest>(getPendingRestoreFilePath())
  if (!manifest?.zipPath || !(await fs.pathExists(manifest.zipPath))) {
    return false
  }

  const syncDir = getSyncDir()
  const tempExtractDir = path.join(syncDir, 'restore-temp')
  const userDataDir = app.getPath('userData')

  await fs.remove(tempExtractDir)
  await fs.ensureDir(tempExtractDir)

  await fs
    .createReadStream(manifest.zipPath)
    .pipe(unzipper.Extract({ path: tempExtractDir }))
    .promise()

  const children = await fs.readdir(tempExtractDir)
  for (const child of children) {
    if (child === SYNC_DIR_NAME) {
      continue
    }

    const sourcePath = path.join(tempExtractDir, child)
    const targetPath = path.join(userDataDir, child)
    await fs.remove(targetPath)
    await fs.copy(sourcePath, targetPath, { overwrite: true })
  }

  await fs.remove(tempExtractDir)
  await fs.remove(manifest.zipPath)
  await fs.remove(getPendingRestoreFilePath())

  return true
}

async function getPersistedConfig() {
  return await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
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

async function runAutoSync(reason: 'startup' | 'interval' | 'save' | 'close') {
  const config = await getPersistedConfig()
  if (!config?.enabled) {
    return
  }

  const shouldRun =
    (reason === 'startup' && config.autoOnStart) ||
    (reason === 'interval' && config.autoEvery5Min) ||
    (reason === 'save' && config.autoOnSave) ||
    (reason === 'close' && config.autoOnClose)

  if (!shouldRun || isSyncing) {
    return
  }

  notifySyncState(true)
  try {
    const { drive } = await getDriveClient()
    const remote = await getRemoteBackupMetadata(drive, config)
    const state = (await readJsonSafe<Record<string, string>>(getStateFilePath())) || {}
    const remoteIsNewer = Boolean(
      remote?.modifiedTime && state.lastSyncAt && remote.modifiedTime > state.lastSyncAt
    )

    if (config.conflictStrategy === 'askBeforeOverwrite' && remoteIsNewer) {
      return
    }

    if (config.conflictStrategy === 'primaryDevice' && config.primaryDeviceName) {
      if (config.deviceName === config.primaryDeviceName) {
        await uploadBackupToDrive()
      } else if (remote?.id) {
        await downloadBackupAndApplyImmediately()
      }
      return
    }

    if (remoteIsNewer) {
      await downloadBackupAndApplyImmediately()
    } else {
      await uploadBackupToDrive()
    }
  } finally {
    notifySyncState(false)
  }
}

export function initializeGoogleDriveSyncManager() {
  runAutoSync('startup').catch(() => {
    notifySyncState(false)
  })

  if (autoSyncInterval) {
    clearInterval(autoSyncInterval)
  }
  autoSyncInterval = setInterval(
    () => {
      runAutoSync('interval').catch(() => {
        notifySyncState(false)
      })
    },
    5 * 60 * 1000
  )

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
      return await uploadBackupToDrive()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.handle('sync:google-drive:pull', async () => {
    notifySyncState(true)
    try {
      return await downloadBackupAndApplyImmediately()
    } finally {
      notifySyncState(false)
    }
  })

  ipcMain.on('sync:google-drive:auto-save-event', () => {
    runAutoSync('save').catch(() => {
      notifySyncState(false)
    })
  })

  app.on('before-quit', () => {
    runAutoSync('close').catch(() => {
      notifySyncState(false)
    })
  })
}
