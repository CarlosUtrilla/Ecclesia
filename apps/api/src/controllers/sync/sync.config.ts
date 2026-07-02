import { getUserDataPath, resolveMediaRoot } from '../../config'
import path from 'path'

// --- File names ---
export const SYNC_DIR_NAME = 'sync'
export const CONFIG_FILE_NAME = 'google-drive-config.json'
export const TOKEN_FILE_NAME = 'google-drive-token.json'
export const STATE_FILE_NAME = 'google-drive-state.json'
export const APP_INSTANCE_ID_FILE_NAME = 'app-instance-id.json'
export const LOCAL_MEDIA_MANIFEST_FILE_NAME = 'media-manifest.json'
export const LOCAL_BIBLE_MANIFEST_FILE_NAME = 'bible-manifest.json'

// --- Schema versions ---
export const MANIFEST_SCHEMA_VERSION = 1
export const SNAPSHOT_SCHEMA_VERSION = 1
export const MEDIA_MANIFEST_SCHEMA_VERSION = 1
export const BIBLE_MANIFEST_SCHEMA_VERSION = 1

// --- Remote file prefixes ---
export const REMOTE_SNAPSHOT_FILE_PREFIX = 'ecclesia-snapshot'
export const REMOTE_MEDIA_MANIFEST_FILE_PREFIX = 'ecclesia-media-manifest'
export const REMOTE_MEDIA_BLOB_FILE_PREFIX = 'ecclesia-media-blob'
export const REMOTE_BIBLE_MANIFEST_FILE_PREFIX = 'ecclesia-bible-manifest'
export const REMOTE_BIBLE_BLOB_FILE_PREFIX = 'ecclesia-bible-blob'

// --- Timing ---
export const GOOGLE_REDIRECT_PORT = 53682
export const PULL_CHECK_INTERVAL_MS = 5 * 60 * 1000
export const MICRO_PUSH_DEBOUNCE_MS = 30_000
export const RETRY_BASE_DELAY_MS = 30 * 1000
export const RETRY_MAX_DELAY_MS = 10 * 60 * 1000
export const HEALTH_CHECK_INTERVAL_MS = 60 * 1000
export const MAX_DRIVE_FILEID_VERIFICATIONS_PER_CYCLE = 20
export const BLOB_REUPLOAD_GRACE_MS = 5 * 60 * 1000
export const MEDIA_VERIFICATION_COOLDOWN_MS = 1 * 60 * 60 * 1000
export const BLOB_UPLOAD_CONCURRENCY = 5

export const DRIVE_FOLDER_NAME = 'Ecclesia'

// --- Types ---
export type GoogleDriveSyncConfig = {
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

export type PersistedSyncConfig = GoogleDriveSyncConfig & {
  updatedAt: string
}

export type SyncState = {
  lastSyncAt?: string
  lastRemoteModifiedAt?: string
  lastSnapshotPushAt?: string
  lastPullCheckAt?: string
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
  lastMediaVerificationAt?: string
}

export type SyncReason =
  | 'startup'
  | 'interval'
  | 'pull-check'
  | 'save'
  | 'close'
  | 'manual-push'
  | 'manual-pull'
  | 'micro-snapshot-push'
  | 'micro-media-push'
  | 'retry'

export type SyncStatus = {
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

export type RemoteManifest = {
  schemaVersion: number
  workspaceId: string
  deviceName: string
  updatedAt: string
  lastSyncAt: string
}

export type SnapshotFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  tables: Record<string, unknown[]>
}

export type MediaManifestEntry = {
  path: string
  size: number
  checksum: string
  mtime: number
  deletedAt?: string | null
  lastSyncedAt?: string | null
  driveFileId?: string | null
}

export type MediaManifestFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  entries: MediaManifestEntry[]
}

export type BibleManifestEntry = {
  fileName: string
  size: number
  checksum: string
  mtime: number
  deletedAt?: string | null
  lastSyncedAt?: string | null
  driveFileId?: string | null
}

export type BibleManifestFile = {
  schemaVersion: number
  workspaceId: string
  deviceId: string
  updatedAt: string
  entries: BibleManifestEntry[]
}

export type SyncResult = {
  synced: boolean
  reason: SyncReason
  syncedAt?: string
  devicesProcessed?: number
  applied?: number
  stale?: number
  snapshotUploaded?: boolean
  mediaUploaded?: number
  mediaDownloaded?: number
  missingRemoteBlobs?: number
  biblesUploaded?: number
  biblesDownloaded?: number
  skipped?: string
  nextRetryAt?: string
}

export type ReconcileResult = {
  dbIndexed: number
  mediaIndexed: number
  biblesIndexed: number
  workspaceId: string
  deviceId: string
}

export type SyncDiagnosticEntry = {
  path: string
  size: number
  localChecksum: string | null
  remoteChecksum: string | null
  localExists: boolean
  remoteBlobExists: boolean
  isTombstone: boolean
  issue: 'ok' | 'missing-locally' | 'missing-in-drive' | 'orphan-local' | 'tombstoned'
}

export type SyncDiagnostic = {
  workspaceId: string
  deviceId: string
  fetchedAt: string
  summary: {
    total: number
    ok: number
    needUpload: number
    needDownload: number
    orphanLocal: number
    tombstoned: number
    totalSizeBytes: number
  }
  details: SyncDiagnosticEntry[]
}

export type RemoteSnapshotDeviceData = {
  deviceId: string
  updatedAt: string
  totalRows: number
  byTable: Record<string, number>
}

export type RemoteDriveData = {
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

// --- Helpers ---
export function toSafeFileSegment(value?: string): string {
  return (value?.trim() || 'default').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function getSnapshotFileName(workspaceId: string, deviceId: string): string {
  return `${REMOTE_SNAPSHOT_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${toSafeFileSegment(deviceId)}.json`
}

export function getManifestFileName(workspaceId?: string): string {
  const normalizedWorkspace = workspaceId?.trim() || 'default'
  return `ecclesia-diff-manifest-${normalizedWorkspace}.json`
}

export function getRemoteMediaManifestFileName(workspaceId?: string): string {
  return `${REMOTE_MEDIA_MANIFEST_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}.json`
}

export function getRemoteMediaBlobFileName(workspaceId: string, checksum: string): string {
  return `${REMOTE_MEDIA_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${checksum}.bin`
}

export function getRemoteBibleManifestFileName(workspaceId?: string): string {
  return `${REMOTE_BIBLE_MANIFEST_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}.json`
}

export function getRemoteBibleBlobFileName(workspaceId: string, checksum: string): string {
  return `${REMOTE_BIBLE_BLOB_FILE_PREFIX}-${toSafeFileSegment(workspaceId)}-${checksum}.bin`
}

export function getSyncDir(): string {
  return path.join(getUserDataPath(), SYNC_DIR_NAME)
}

export function getConfigFilePath(): string {
  return path.join(getSyncDir(), CONFIG_FILE_NAME)
}

export function getTokenFilePath(): string {
  return path.join(getSyncDir(), TOKEN_FILE_NAME)
}

export function getStateFilePath(): string {
  return path.join(getSyncDir(), STATE_FILE_NAME)
}

export function getAppInstanceIdFilePath(): string {
  return path.join(getSyncDir(), APP_INSTANCE_ID_FILE_NAME)
}

export function getLocalMediaManifestPath(): string {
  return path.join(getSyncDir(), LOCAL_MEDIA_MANIFEST_FILE_NAME)
}

export function getLocalBibleManifestPath(): string {
  return path.join(getSyncDir(), LOCAL_BIBLE_MANIFEST_FILE_NAME)
}

export function getBiblesDir(): string {
  return path.join(getUserDataPath(), 'bibles')
}

export function getMediaDir(): string {
  return resolveMediaRoot()
}

export function calculateRetryDelayMs(retryCount: number): number {
  const raw = RETRY_BASE_DELAY_MS * 2 ** Math.max(retryCount - 1, 0)
  return Math.min(raw, RETRY_MAX_DELAY_MS)
}

export function buildRetryBackoffState(currentRetryCount = 0, nowMs = Date.now()) {
  const retryCount = currentRetryCount + 1
  const delayMs = calculateRetryDelayMs(retryCount)
  const nextRetryAt = new Date(nowMs + delayMs).toISOString()
  return { retryCount, delayMs, nextRetryAt, nextRunAt: nextRetryAt }
}

export function normalizeConfig(
  config: Partial<GoogleDriveSyncConfig>
): GoogleDriveSyncConfig {
  return {
    enabled: Boolean(config.enabled),
    workspaceId: config.workspaceId || '',
    deviceName: config.deviceName || 'Este dispositivo',
    conflictStrategy: config.conflictStrategy || 'lastWriteWins',
    primaryDeviceName: config.primaryDeviceName || '',
    autoOnStart: config.autoOnStart ?? true,
    autoEvery5Min: config.autoEvery5Min ?? true,
    autoOnSave: config.autoOnSave ?? true,
    autoOnClose: config.autoOnClose ?? true
  }
}

// --- Snapshot model definitions ---
export type SnapshotModelDefinition = {
  modelName: string
  delegateName: string
}

export const SNAPSHOT_MODELS: SnapshotModelDefinition[] = [
  { modelName: 'TagSongs', delegateName: 'tagSongs' },
  { modelName: 'Song', delegateName: 'song' },
  { modelName: 'Lyrics', delegateName: 'lyrics' },
  { modelName: 'Font', delegateName: 'font' },
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
