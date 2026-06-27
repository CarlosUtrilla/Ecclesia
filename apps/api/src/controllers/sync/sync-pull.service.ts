import log from 'electron-log'
import { drive_v3 } from 'googleapis'
import SyncService from './sync.service'
import { PersistedSyncConfig, getManifestFileName, RemoteManifest } from './sync.config'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import { syncBibleService } from './sync-bible.service'
import { syncProgressService } from './sync-progress.service'
import { syncDriveOpsService } from './sync-drive-ops.service'
import { driveClientService } from './sync-drive-client.service'
import { syncStateService } from './sync-state.service'

export class SyncPullService {
  async hasRemoteChanges(): Promise<boolean> {
    try {
      const { drive, config } = await driveClientService.getDriveClient()
      const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
      const manifestFileName = getManifestFileName(config.workspaceId)

      const existing = await syncDriveOpsService.findFileByName(drive, folderId, manifestFileName)
      if (!existing?.id) {
        log.warn('[sync] No hay manifiesto remoto — se necesita sync completo')
        return true
      }

      const remoteManifest = await syncDriveOpsService.downloadJsonFile<RemoteManifest>(drive, existing.id)
      if (!remoteManifest) {
        log.warn('[sync] No se pudo leer manifiesto remoto — se necesita sync completo')
        return true
      }

      const state = await syncStateService.getState()
      const localTimestamp = state.lastSyncAt

      if (!localTimestamp) {
        log.warn('[sync] Sin timestamp local — se necesita sync completo')
        return true
      }

      const remoteTime = new Date(remoteManifest.lastSyncAt).getTime()
      const localTime = new Date(localTimestamp).getTime()

      if (Number.isNaN(remoteTime) || Number.isNaN(localTime)) {
        log.warn('[sync] Timestamps inválidos — se necesita sync completo')
        return true
      }

      const hasChanges = remoteTime > localTime
      log.warn(`[sync] Pull check: remoto=${remoteManifest.lastSyncAt}, local=${localTimestamp}, cambios=${hasChanges}`)
      return hasChanges
    } catch (err) {
      log.error('[sync] Error en pull check:', err)
      return true
    }
  }
  async pull(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string
  ) {
    syncProgressService.setPhaseRange(0, 50)
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

    const settled = await Promise.allSettled([mediaPromise, biblePromise])

    let mediaDownloaded = 0
    let mediaMissingBlobs = 0
    let bibleDownloaded = 0

    if (settled[0].status === 'fulfilled') {
      mediaDownloaded = settled[0].value.downloaded
      mediaMissingBlobs = settled[0].value.missingRemoteBlobs
    } else {
      log.error('[sync] Media pull falló:', settled[0].reason)
    }

    if (settled[1].status === 'fulfilled') {
      bibleDownloaded = settled[1].value.downloaded
    } else {
      log.error('[sync] Bible pull falló:', settled[1].reason)
    }

    syncProgressService.update(100, 'Pull completado')

    return {
      devicesProcessed: pullResult.devicesProcessed,
      applied: pullResult.applied,
      stale: pullResult.stale,
      skipped: pullResult.skipped,
      failed: pullResult.failed,
      mediaDownloaded,
      mediaMissingBlobs,
      bibleDownloaded
    }
  }
}

export const syncPullService = new SyncPullService()
