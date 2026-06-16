import { drive_v3 } from 'googleapis'
import { getPrisma } from '../../prisma'
import {
  PersistedSyncConfig,
  getConfigFilePath,
  getTokenFilePath
} from './sync.config'
import { readJsonSafe } from './sync.utils'
import { syncSnapshotService } from './sync-snapshot.service'
import { syncMediaService } from './sync-media.service'
import { syncBibleService } from './sync-bible.service'
import { driveClientService } from './sync-drive-client.service'

export class SyncPushService {
  async pushSnapshotOnly(): Promise<void> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    if (!config?.enabled) return
    const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
    if (!token) return

    if (!config.workspaceId) config.workspaceId = 'default'
    if (!config.deviceName) config.deviceName = 'Este dispositivo'

    try {
      const { drive } = await driveClientService.getDriveClient()
      const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
      const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
      const snapshot = await syncSnapshotService.buildSnapshot(config, appInstanceId)
      await syncSnapshotService.uploadSnapshot(drive, config, snapshot, folderId)
    } catch (err) {
      console.error('[sync] pushSnapshotOnly falló:', err)
    }
  }

  async pushMediaOnly(): Promise<void> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    if (!config?.enabled) return
    const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
    if (!token) return

    if (!config.workspaceId) config.workspaceId = 'default'
    if (!config.deviceName) config.deviceName = 'Este dispositivo'

    try {
      const { drive } = await driveClientService.getDriveClient()
      const appInstanceId = await driveClientService.getOrCreateAppInstanceId()
      const folderId = await driveClientService.getOrCreateEcclesiaFolder(drive)
      await syncMediaService.syncMediaManifest(drive, config, 'push', appInstanceId, folderId)
    } catch (err) {
      console.error('[sync] pushMediaOnly falló:', err)
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

  private async writeRemoteManifest(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    folderId: string
  ) {
    const { getManifestFileName } = await import('./sync.config')
    const manifestFileName = getManifestFileName(config.workspaceId)
    const manifest = {
      schemaVersion: 1,
      workspaceId: config.workspaceId,
      deviceName: config.deviceName,
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString()
    }

    const result = await drive.files.list({
      q: `name='${manifestFileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id)',
      pageSize: 1
    })
    const existing = result.data.files?.[0]
    const media = { mimeType: 'application/json', body: JSON.stringify(manifest) }

    if (existing?.id) {
      await drive.files.update({ fileId: existing.id, media, fields: 'id' })
      return
    }
    await drive.files.create({
      requestBody: { name: manifestFileName, parents: [folderId] },
      media,
      fields: 'id'
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

    if (reason !== 'manual-pull') {
      const latestPendingOutboxId = await this.getLatestPendingOutboxChangeId(
        config.workspaceId,
        config.deviceName
      )

      if (latestPendingOutboxId !== null || snapApplied > 0) {
        const snapshot = await syncSnapshotService.buildSnapshot(config, appInstanceId)
        await syncSnapshotService.uploadSnapshot(drive, config, snapshot, folderId)
        if (latestPendingOutboxId !== null) {
          await this.acknowledgeOutboxUpToId(config.workspaceId, config.deviceName, latestPendingOutboxId)
        }
        snapshotUploaded = true
      }

      const [mediaRes, bibleRes] = await Promise.all([
        syncMediaService.syncMediaManifest(drive, config, 'push', appInstanceId, folderId),
        syncBibleService.syncBibleFiles(drive, config, 'push', appInstanceId)
      ])
      mediaUploaded = mediaRes.uploaded
      bibleUploaded = bibleRes.uploaded
      missingRemoteBlobs = mediaRes.missingRemoteBlobs

      if (snapshotUploaded || mediaUploaded > 0 || bibleUploaded > 0 || missingRemoteBlobs > 0) {
        await this.writeRemoteManifest(drive, config, folderId)
      }
    }

    return { snapshotUploaded, mediaUploaded, bibleUploaded, missingRemoteBlobs }
  }
}

export const syncPushService = new SyncPushService()
