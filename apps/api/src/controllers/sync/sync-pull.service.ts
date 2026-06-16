import log from 'electron-log'
import { drive_v3 } from 'googleapis'
import SyncService from './sync.service'
import { PersistedSyncConfig } from './sync.config'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import { syncBibleService } from './sync-bible.service'
import { syncProgressService } from './sync-progress.service'

export class SyncPullService {
  async pull(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ) {
    syncProgressService.update(10, 'Iniciando pull...')

    syncProgressService.update(20, 'Aplicando snapshots remotos...')
    const syncService = new SyncService()

    const pullResult = await syncSnapshotService.pullAndApplySnapshots(
      drive, config, appInstanceId, folderId, syncService
    )
    log.warn(`[sync] Snapshots aplicados: ${pullResult.devicesProcessed} dispositivos, ${pullResult.applied} filas`)

    syncProgressService.update(50, 'Sincronizando archivos multimedia remotos...')
    const mediaPromise = syncMediaService.syncMediaManifest(
      drive, config, 'pull', appInstanceId, folderId
    ).then(res => {
      log.warn(`[sync] Media pull: ${res.downloaded} descargados, ${res.missingRemoteBlobs} faltantes`)
      return res
    })

    syncProgressService.setMessage('Sincronizando biblias...')
    const biblePromise = syncBibleService.syncBibleFiles(
      drive, config, 'pull', appInstanceId
    ).then(res => {
      log.warn(`[sync] Bible pull: ${res.downloaded} descargados`)
      return res
    })

    const [pullMediaResult, pullBibleResult] = await Promise.all([mediaPromise, biblePromise])

    syncProgressService.update(100, 'Pull completado')

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
