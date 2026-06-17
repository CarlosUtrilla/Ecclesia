import log from 'electron-log'
import { drive_v3 } from 'googleapis'
import { getPrisma } from '../../prisma'
import {
  PersistedSyncConfig,
  getConfigFilePath,
  getTokenFilePath,
  getManifestFileName
} from './sync.config'
import { readJsonSafe } from './sync.utils'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import { syncBibleService } from './sync-bible.service'
import { driveClientService } from './sync-drive-client.service'
import { syncDriveOpsService } from './sync-drive-ops.service'
import { syncProgressService } from './sync-progress.service'

async function loadConfigAndToken(): Promise<{ config: PersistedSyncConfig; token: Record<string, unknown> } | null> {
  const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
  if (!config?.enabled) return null
  const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
  if (!token) return null
  if (!config.workspaceId) config.workspaceId = 'default'
  if (!config.deviceName) config.deviceName = 'Este dispositivo'
  return { config, token }
}

export class SyncPushService {
  async pushSnapshotOnly(): Promise<void> {
    const loaded = await loadConfigAndToken()
    if (!loaded) return

    try {
      syncProgressService.update(10, 'Conectando con Google Drive...')
      const { drive } = await driveClientService.getDriveClient()
      const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
      const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)

      syncProgressService.update(25, 'Construyendo snapshot de base de datos...')
      const snapshot = await syncSnapshotService.buildSnapshot(loaded.config, appInstanceId)

      syncProgressService.update(60, 'Subiendo snapshot a Google Drive...')
      await syncSnapshotService.uploadSnapshot(drive, loaded.config, snapshot, folderId)

      syncProgressService.update(100, 'Snapshot subido correctamente')
    } catch (err) {
      log.error('[sync] pushSnapshotOnly falló:', err)
      syncProgressService.error(`pushSnapshotOnly falló: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  async pushMediaOnly(): Promise<void> {
    const loaded = await loadConfigAndToken()
    if (!loaded) return

    try {
      syncProgressService.update(10, 'Conectando con Google Drive...')
      const { drive } = await driveClientService.getDriveClient()
      const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
      const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)

      syncProgressService.update(30, 'Sincronizando archivos multimedia...')
      const result = await syncMediaService.syncMediaManifest(drive, loaded.config, 'push', appInstanceId, folderId)

      syncProgressService.update(100, `Media sincronizada: ${result.uploaded} archivos subidos`)
      log.warn(`[sync] pushMediaOnly completado: ${result.uploaded} subidos, ${result.missingRemoteBlobs} blobs faltantes`)
    } catch (err) {
      log.error('[sync] pushMediaOnly falló:', err)
      syncProgressService.error(`pushMediaOnly falló: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  async getLatestPendingOutboxChangeId(workspaceId: string, deviceId: string) {
    const prisma = getPrisma()
    const delegate = prisma as unknown as {
      syncOutboxChange?: {
        findFirst?: (args: {
          where: { workspaceId: string; deviceId: string; ackedAt: null }
          orderBy: { id: 'desc' }
          select: { id: true }
        }) => Promise<{ id: number } | null>
      }
    }
    if (!delegate.syncOutboxChange?.findFirst) return null
    const latest = await delegate.syncOutboxChange.findFirst({
      where: { workspaceId, deviceId, ackedAt: null },
      orderBy: { id: 'desc' },
      select: { id: true }
    })
    return typeof latest?.id === 'number' ? latest.id : null
  }

  async acknowledgeOutboxUpToId(workspaceId: string, deviceId: string, upToId: number) {
    const prisma = getPrisma()
    const delegate = prisma as unknown as {
      syncOutboxChange?: {
        updateMany?: (args: {
          where: {
            workspaceId: string
            deviceId: string
            ackedAt: null
            id: { lte: number }
          }
          data: { ackedAt: Date }
        }) => Promise<unknown>
      }
      syncState?: {
        upsert?: (args: {
          where: { workspaceId_deviceId: { workspaceId: string; deviceId: string } }
          create: { workspaceId: string; deviceId: string; lastAckedChangeId: number; lastPushedAt: Date }
          update: { lastAckedChangeId: number; lastPushedAt: Date }
        }) => Promise<unknown>
      }
    }

    if (!delegate.syncOutboxChange?.updateMany) return
    const now = new Date()
    await delegate.syncOutboxChange.updateMany({
      where: { workspaceId, deviceId, ackedAt: null, id: { lte: upToId } },
      data: { ackedAt: now }
    })
    if (!delegate.syncState?.upsert) return
    await delegate.syncState.upsert({
      where: { workspaceId_deviceId: { workspaceId, deviceId } },
      create: { workspaceId, deviceId, lastAckedChangeId: upToId, lastPushedAt: now },
      update: { lastAckedChangeId: upToId, lastPushedAt: now }
    })
  }

  async push(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string,
    reason: string,
    snapApplied: number
  ): Promise<{
    snapshotUploaded: boolean
    mediaUploaded: number
    bibleUploaded: number
    missingRemoteBlobs: number
  }> {
    let snapshotUploaded = false
    let mediaUploaded = 0
    let bibleUploaded = 0
    let missingRemoteBlobs = 0

    syncProgressService.setPhaseRange(50, 100)

    if (reason !== 'manual-pull') {
      syncProgressService.update(10, 'Verificando cambios pendientes...')
      const latestPendingOutboxId = await this.getLatestPendingOutboxChangeId(
        config.workspaceId,
        config.deviceName
      )

      if (latestPendingOutboxId !== null || snapApplied > 0) {
        syncProgressService.update(15, 'Construyendo snapshot de base de datos...')
        const snapshot = await syncSnapshotService.buildSnapshot(config, appInstanceId)
        log.warn(`[sync] Snapshot construido: ${Object.keys(snapshot.tables).length} tablas`)

        syncProgressService.update(25, 'Subiendo snapshot a Google Drive...')
        await syncSnapshotService.uploadSnapshot(drive, config, snapshot, folderId)
        snapshotUploaded = true
        syncProgressService.setMessage('Snapshot subido, sincronizando archivos...')
      }

      syncProgressService.update(35, 'Sincronizando archivos multimedia...')
      const mediaPromise = syncMediaService.syncMediaManifest(
        drive, config, 'push', appInstanceId, folderId
      ).then(res => {
        log.warn(`[sync] Media sync completado: ${res.uploaded} subidos, ${res.downloaded} descargados, ${res.missingRemoteBlobs} blobs faltantes`)
        return res
      })

      const biblePromise = syncBibleService.syncBibleFiles(
        drive, config, 'push', appInstanceId
      ).then(res => {
        log.warn(`[sync] Bible sync completado: ${res.uploaded} subidos, ${res.downloaded} descargados`)
        return res
      })

      const settled = await Promise.allSettled([mediaPromise, biblePromise])

      if (settled[0].status === 'fulfilled') {
        mediaUploaded = settled[0].value.uploaded
        missingRemoteBlobs = settled[0].value.missingRemoteBlobs
      } else {
        log.error('[sync] Media sync falló:', settled[0].reason)
      }

      if (settled[1].status === 'fulfilled') {
        bibleUploaded = settled[1].value.uploaded
      } else {
        log.error('[sync] Bible sync falló:', settled[1].reason)
      }

      if (latestPendingOutboxId !== null && snapshotUploaded) {
        await this.acknowledgeOutboxUpToId(config.workspaceId, config.deviceName, latestPendingOutboxId)
      }

      syncProgressService.update(80, 'Actualizando manifiesto remoto...')
      const manifestFileName = getManifestFileName(config.workspaceId)
      const manifest = {
        schemaVersion: 1,
        workspaceId: config.workspaceId,
        deviceName: config.deviceName,
        updatedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      }

      if (snapshotUploaded || mediaUploaded > 0 || bibleUploaded > 0 || missingRemoteBlobs > 0) {
        await syncDriveOpsService.upsertFile(drive, folderId, manifestFileName, manifest)
      }

      syncProgressService.update(100, 'Push completado')
      log.warn(`[sync] Push finalizado: snapshot=${snapshotUploaded}, media=${mediaUploaded}, bible=${bibleUploaded}, missing=${missingRemoteBlobs}`)
    }

    return { snapshotUploaded, mediaUploaded, bibleUploaded, missingRemoteBlobs }
  }
}

export const syncPushService = new SyncPushService()
