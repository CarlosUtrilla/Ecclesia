import { getUserDataPath, resolveMediaRoot } from '../../config'
import path from 'path'
import fs from 'fs-extra'

// --- File names ---
export const SYNC_DIR_NAME = 'sync'
export const CONFIG_FILE_NAME = 'google-drive-config.json'
export const TOKEN_FILE_NAME = 'google-drive-token.json'
export const APP_INSTANCE_ID_FILE_NAME = 'app-instance-id.json'
export const LOCAL_MEDIA_MANIFEST_FILE_NAME = 'media-manifest.json'
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
  lastRunReason?: string
  lastRunStatus?: 'ok' | 'error'
  lastRunError?: string
  retryCount?: number
  nextRetryAt?: string
  schedulerHealthy?: boolean
  lastSchedulerHeartbeatAt?: string
}

// --- Path helpers ---
export function getSyncDir(): string {
  return path.join(getUserDataPath(), SYNC_DIR_NAME)
}

export function getConfigFilePath(): string {
  return path.join(getSyncDir(), CONFIG_FILE_NAME)
}

export function getTokenFilePath(): string {
  return path.join(getSyncDir(), TOKEN_FILE_NAME)
}

export function getAppInstanceIdFilePath(): string {
  return path.join(getSyncDir(), APP_INSTANCE_ID_FILE_NAME)
}

export function getLocalMediaManifestPath(): string {
  return path.join(getSyncDir(), LOCAL_MEDIA_MANIFEST_FILE_NAME)
}

export function getMediaDir(): string {
  return resolveMediaRoot()
}

// --- Config helpers ---
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

// --- I/O utilities ---
export async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!(await fs.pathExists(filePath))) return null
    return (await fs.readJSON(filePath)) as T
  } catch {
    return null
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath))
  await fs.writeJSON(filePath, value, { spaces: 2 })
}
