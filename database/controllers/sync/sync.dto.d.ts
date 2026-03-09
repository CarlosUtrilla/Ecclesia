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
