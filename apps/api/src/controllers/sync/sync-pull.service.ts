import { drive_v3 } from 'googleapis'
import SyncService from './sync.service'
import { PersistedSyncConfig } from './sync.config'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import { syncBibleService } from './sync-bible.service'

export class SyncPullService {
  async pull(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ) {
    const syncService = new SyncService()

    const pullResult = await syncSnapshotService.pullAndApplySnapshots(
      drive, config, appInstanceId, folderId, syncService
    )

    const [pullMediaResult, pullBibleResult] = await Promise.all([
      syncMediaService.syncMediaManifest(drive, config, 'pull', appInstanceId, folderId),
      syncBibleService.syncBibleFiles(drive, config, 'pull', appInstanceId)
    ])

    return {
      devicesProcessed: pullResult.devicesProcessed,
      applied: pullResult.applied,
      stale: pullResult.stale,
      skipped: pullResult.skipped,
      failed: pullResult.failed,
      mediaDownloaded: pullMediaResult.downloaded,
      mediaMissingBlobs: pullMediaResult.missingRemoteBlobs,
      bibleDownloaded: pullBibleResult.downloaded
    }
  }
}

export const syncPullService = new SyncPullService()
