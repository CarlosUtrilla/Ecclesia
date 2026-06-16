import { RequestHandler } from '../../utils/RequestHandler'
import {
  ApplyPendingInboxBatchDTO,
  AckOutboxChangesDTO,
  AppendOutboxChangeDTO,
  IngestRemoteChangesDTO,
  MarkInboxAppliedDTO,
  PendingInboxChangesDTO,
  PendingOutboxChangesDTO,
  SyncStateDTO,
  UpsertSyncStateDTO,
  SyncConfigDTO
} from './sync.dto'
import SyncService from './sync.service'
import { driveClientService } from './sync-drive-client.service'
import { syncStateService } from './sync-state.service'
import { syncPushService } from './sync-push.service'
import { syncPullService } from './sync-pull.service'
import { syncDiagnosticService } from './sync-diagnostic.service'
import { syncCleanupService } from './sync-cleanup.service'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import {
  getConfigFilePath,
  getTokenFilePath,
  PersistedSyncConfig,
  SyncStatus,
  normalizeConfig,
  getManifestFileName,
  SyncDiagnostic,
  RemoteDriveData,
  RemoteSnapshotDeviceData,
  SyncReason,
  SyncResult
} from './sync.config'
import { readJsonSafe, writeJson } from './sync.utils'

class SyncController {
  private syncService = new SyncService()

  async getSyncState({ body }: RequestHandler<SyncStateDTO>) {
    return await this.syncService.getSyncState(body)
  }

  async upsertSyncState({ body }: RequestHandler<UpsertSyncStateDTO>) {
    return await this.syncService.upsertSyncState(body)
  }

  async appendOutboxChange({ body }: RequestHandler<AppendOutboxChangeDTO>) {
    return await this.syncService.appendOutboxChange(body)
  }

  async getPendingOutboxChanges({ body }: RequestHandler<PendingOutboxChangesDTO>) {
    return await this.syncService.getPendingOutboxChanges(body)
  }

  async acknowledgeOutboxChanges({ body }: RequestHandler<AckOutboxChangesDTO>) {
    return await this.syncService.acknowledgeOutboxChanges(body)
  }

  async ingestRemoteChanges({ body }: RequestHandler<IngestRemoteChangesDTO>) {
    return await this.syncService.ingestRemoteChanges(body)
  }

  async getPendingInboxChanges({ body }: RequestHandler<PendingInboxChangesDTO>) {
    return await this.syncService.getPendingInboxChanges(body)
  }

  async markInboxChangesApplied({ body }: RequestHandler<MarkInboxAppliedDTO>) {
    return await this.syncService.markInboxChangesApplied(body)
  }

  async applyPendingInboxBatch({ body }: RequestHandler<ApplyPendingInboxBatchDTO>) {
    return await this.syncService.applyPendingInboxBatch(body)
  }

  // --- Sync Drive methods (new modular sync) ---

  async getStatus(): Promise<SyncStatus> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
    const state = await syncStateService.getState()

    const status: SyncStatus = {
      connected: !!token,
      pendingRestore: false,
      workspaceId: config?.workspaceId || 'default',
      deviceName: config?.deviceName || 'Este dispositivo',
      systemHostname: undefined,
      ...state
    }

    if (token?.email) status.accountEmail = token.email as string
    if (token?.name) status.accountName = token.name as string

    return status
  }

  async configure({ body }: RequestHandler<SyncConfigDTO>): Promise<void> {
    const existing = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const normalized = normalizeConfig(body)
    const merged: PersistedSyncConfig = {
      ...existing,
      ...normalized,
      updatedAt: new Date().toISOString()
    }
    await writeJson(getConfigFilePath(), merged)
  }

  async connect({ body }: RequestHandler<SyncConfigDTO>): Promise<{ authUrl: string }> {
    const normalized = normalizeConfig(body)
    const config: PersistedSyncConfig = {
      ...normalized,
      updatedAt: new Date().toISOString()
    }
    await writeJson(getConfigFilePath(), config)
    const authUrl = driveClientService.getAuthUrl()
    return { authUrl }
  }

  async disconnect(): Promise<void> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    if (config) {
      config.enabled = false
      await writeJson(getConfigFilePath(), config)
    }
    driveClientService.clearCachedFolderId()
  }

  async push({ body }: RequestHandler<{ reason: SyncReason; snapApplied?: number }>): Promise<SyncResult> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const reason = body.reason || 'manual-push'
    const snapApplied = body.snapApplied ?? 0

    const result = await syncPushService.push(drive, config, appInstanceId, folderId, reason, snapApplied)
    await syncStateService.recordSuccess(reason)

    return {
      synced: true,
      reason,
      syncedAt: new Date().toISOString(),
      snapshotUploaded: result.snapshotUploaded,
      mediaUploaded: result.mediaUploaded,
      mediaDownloaded: 0,
      biblesUploaded: result.bibleUploaded,
      missingRemoteBlobs: result.missingRemoteBlobs
    }
  }

  async pull({ body }: RequestHandler<{ reason?: SyncReason }>): Promise<SyncResult> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    const reason = body.reason || 'manual-pull'

    const result = await syncPullService.pull(drive, config, appInstanceId, folderId)
    await syncStateService.recordSuccess(reason)

    return {
      synced: true,
      reason,
      syncedAt: new Date().toISOString(),
      devicesProcessed: result.devicesProcessed,
      applied: result.applied,
      stale: result.stale,
      skipped: result.skipped?.toString(),
      mediaDownloaded: result.mediaDownloaded,
      biblesDownloaded: result.bibleDownloaded,
      missingRemoteBlobs: result.mediaMissingBlobs
    }
  }

  async reconcile(): Promise<{
    dbIndexed: number
    mediaIndexed: number
    biblesIndexed: number
    workspaceId: string
    deviceId: string
  }> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)

    const { default: SyncService } = await import('./sync.service')
    const syncService = new SyncService()

    const pullResult = await syncSnapshotService.pullAndApplySnapshots(
      drive, config, appInstanceId, folderId, syncService
    )

    const [mediaResult, bibleResult] = await Promise.all([
      syncMediaService.syncMediaManifest(drive, config, 'push', appInstanceId, folderId),
      (await import('./sync-bible.service')).syncBibleService.syncBibleFiles(drive, config, 'push', appInstanceId)
    ])

    return {
      dbIndexed: pullResult.applied,
      mediaIndexed: mediaResult.uploaded,
      biblesIndexed: bibleResult.uploaded,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId
    }
  }

  async getRemoteData(): Promise<RemoteDriveData> {
    const { drive, config } = await driveClientService.getDriveClient()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)

    const snapshotFiles = await syncSnapshotService.listAllRemoteSnapshotFiles(drive, config.workspaceId, folderId)
    const devices: RemoteSnapshotDeviceData[] = []
    const myDeviceSafe = (await driveClientService.getOrCreateAppInstanceId()).replace(/[^a-zA-Z0-9._-]/g, '_')
    const expectedPrefix = `ecclesia-snapshot-${config.workspaceId.replace(/[^a-zA-Z0-9._-]/g, '_')}-`
    for (const fileMeta of snapshotFiles) {
      const fileName = fileMeta.name || ''
      if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue
      const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
      if (!deviceSegment || deviceSegment === myDeviceSafe) continue
      try {
        const { streamToString } = await import('./sync.utils')
        const response = await drive.files.get(
          { fileId: fileMeta.id || '', alt: 'media' },
          { responseType: 'stream' }
        )
        const raw = await streamToString(response.data as NodeJS.ReadableStream)
        const parsed = JSON.parse(raw)
        if (!parsed || parsed.workspaceId !== config.workspaceId) continue
        const tables: Record<string, unknown[]> = parsed.tables || {}
        const totalRows = Object.keys(tables).reduce((acc: number, key: string) => acc + (tables[key]?.length ?? 0), 0)
        const byTable: Record<string, number> = {}
        for (const [table, rows] of Object.entries(tables)) {
          byTable[table] = (rows as unknown[])?.length ?? 0
        }
        devices.push({
          deviceId: parsed.deviceId || deviceSegment,
          updatedAt: parsed.updatedAt || '',
          totalRows,
          byTable
        })
      } catch { /* skip */ }
    }

    const manifestFileName = getManifestFileName(config.workspaceId)
    let manifest: RemoteDriveData['manifest'] = null
    try {
      const res = await drive.files.list({
        q: `name='${manifestFileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      })
      if (res.data.files?.[0]?.id) {
        const content = await drive.files.get({
          fileId: res.data.files[0].id,
          alt: 'media'
        })
        manifest = content.data as RemoteDriveData['manifest']
      }
    } catch { /* no manifest */ }

    const mediaManifest = await syncMediaService.readRemoteMediaManifest(drive, config.workspaceId, folderId)
    const media = mediaManifest
      ? {
          totalFiles: mediaManifest.entries.length,
          activeFiles: mediaManifest.entries.filter(e => !e.deletedAt).length,
          deletedFiles: mediaManifest.entries.filter(e => e.deletedAt).length,
          totalSizeBytes: mediaManifest.entries.reduce((acc, e) => acc + (e.size || 0), 0),
          entries: mediaManifest.entries.map(e => ({
            path: e.path,
            size: e.size,
            checksum: e.checksum,
            deletedAt: e.deletedAt || null,
            lastSyncedAt: e.lastSyncedAt || null
          }))
        }
      : null

    return {
      fetchedAt: new Date().toISOString(),
      workspaceId: config.workspaceId,
      manifest,
      devices,
      media,
      bibles: null
    }
  }

  async diagnose(): Promise<SyncDiagnostic> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    return await syncDiagnosticService.diagnoseSyncIssues(drive, config, appInstanceId, folderId)
  }

  async heal({ body }: RequestHandler<{ diagnostic: SyncDiagnostic }>): Promise<{
    uploaded: number
    downloaded: number
    errors: Array<{ path: string; error: string }>
  }> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    return await syncDiagnosticService.healSyncIssues(drive, body.diagnostic, config, appInstanceId, folderId)
  }

  async cleanupMedia(): Promise<{
    deletedOrphans: number
    deletedStale: number
    totalFreedBytes: number
    driveDeleted: number
    driveErrors: number
    details: Array<{ path: string; reason: string; size: number; driveDeleted: boolean }>
  }> {
    const { drive, config } = await driveClientService.getDriveClient()
    const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
    const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
    return await syncCleanupService.cleanupOrphanMediaFromDiskAndDrive(drive, config, appInstanceId, folderId)
  }
}

export default SyncController
