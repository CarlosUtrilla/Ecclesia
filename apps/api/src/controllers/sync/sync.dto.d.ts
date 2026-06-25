import { SyncOperation } from '@prisma/client'

export type SyncStateDTO = {
  workspaceId: string
  deviceId: string
}

export type UpsertSyncStateDTO = {
  workspaceId: string
  deviceId: string
  lastPulledAt?: string | null
  lastPushedAt?: string | null
  lastAckedChangeId?: number | null
}

export type AppendOutboxChangeDTO = {
  workspaceId: string
  deviceId: string
  tableName: string
  recordId: string
  operation: SyncOperation
  payload: string
  entityUpdatedAt: string
  deletedAt?: string | null
}

export type PendingOutboxChangesDTO = {
  workspaceId: string
  deviceId: string
  afterId?: number
  limit?: number
}

export type AckOutboxChangesDTO = {
  workspaceId: string
  deviceId: string
  changeIds?: number[]
  upToId?: number
}

export type RemoteSyncChangeDTO = {
  remoteChangeId: string
  tableName: string
  recordId: string
  operation: SyncOperation
  payload: string
  entityUpdatedAt: string
  deletedAt?: string | null
}

export type IngestRemoteChangesDTO = {
  workspaceId: string
  sourceDeviceId: string
  changes: RemoteSyncChangeDTO[]
}

export type PendingInboxChangesDTO = {
  workspaceId: string
  sourceDeviceId?: string
  afterId?: number
  limit?: number
}

export type MarkInboxAppliedDTO = {
  workspaceId: string
  ids: number[]
}

export type ApplyPendingInboxBatchDTO = {
  workspaceId: string
  sourceDeviceId?: string
  limit?: number
}

// --- OAuth DTOs ---

export type SyncAuthUrlDTO = {
  redirectUri?: string
}

export type ExchangeOAuthCodeDTO = {
  code: string
}

// --- Sync Drive DTOs (new modular sync) ---

export type SyncStatusDTO = {
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

export type SyncReason = 'startup' | 'interval' | 'save' | 'close' | 'manual-push' | 'manual-pull' | 'retry'

export type SyncPushResultDTO = {
  synced: boolean
  reason: SyncReason
  syncedAt?: string
  snapshotUploaded: boolean
  mediaUploaded: number
  bibleUploaded: number
  missingRemoteBlobs: number
}

export type SyncPullResultDTO = {
  synced: boolean
  reason: SyncReason
  syncedAt?: string
  devicesProcessed: number
  applied: number
  stale: number
  skipped: number
  failed: number
  mediaDownloaded: number
  mediaMissingBlobs: number
  bibleDownloaded: number
}

export type SyncReconcileResultDTO = {
  dbIndexed: number
  mediaIndexed: number
  biblesIndexed: number
  workspaceId: string
  deviceId: string
}

export type SyncDiagnosticDTO = {
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
  details: Array<{
    path: string
    size: number
    localChecksum: string | null
    remoteChecksum: string | null
    localExists: boolean
    remoteBlobExists: boolean
    isTombstone: boolean
    issue: 'ok' | 'missing-locally' | 'missing-in-drive' | 'orphan-local' | 'tombstoned'
  }>
}

export type SyncHealResultDTO = {
  uploaded: number
  downloaded: number
  errors: Array<{ path: string; error: string }>
}

export type SyncCleanupResultDTO = {
  deletedOrphans: number
  deletedStale: number
  totalFreedBytes: number
  driveDeleted: number
  driveErrors: number
  details: Array<{ path: string; reason: string; size: number; driveDeleted: boolean }>
}

export type SyncConfigDTO = {
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

export type SyncRemoteDriveDataDTO = {
  fetchedAt: string
  workspaceId: string
  manifest: {
    deviceName: string
    updatedAt: string
    lastSyncAt: string
  } | null
  devices: Array<{
    deviceId: string
    updatedAt: string
    totalRows: number
    byTable: Record<string, number>
  }>
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
