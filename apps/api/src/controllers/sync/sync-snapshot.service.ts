import { drive_v3 } from 'googleapis'
import { getPrisma } from '../../prisma'
import {
  SNAPSHOT_MODELS,
  SNAPSHOT_SCHEMA_VERSION,
  getSnapshotFileName,
  PersistedSyncConfig,
  SnapshotFile
} from './sync.config'
import { streamToString } from './sync.utils'
import SyncService from './sync.service'

export class SyncSnapshotService {
  async buildSnapshot(
    config: PersistedSyncConfig,
    appInstanceId: string
  ): Promise<SnapshotFile> {
    const prisma = getPrisma()
    const prismaRecord = prisma as unknown as Record<string, unknown>
    const tables: Record<string, unknown[]> = {}

    for (const model of SNAPSHOT_MODELS) {
      const delegate = prismaRecord[model.delegateName] as
        | { findMany: () => Promise<unknown[]> }
        | undefined
      if (!delegate?.findMany) continue
      tables[model.modelName] = await delegate.findMany()
    }

    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: new Date().toISOString(),
      tables
    }
  }

  async getSnapshotFileMetadata(
    drive: drive_v3.Drive,
    workspaceId: string,
    deviceId: string,
    folderId: string
  ) {
    const fileName = getSnapshotFileName(workspaceId, deviceId)
    const result = await drive.files.list({
      q: `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 1
    })
    return result.data.files?.[0]
  }

  async uploadSnapshot(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    snapshot: SnapshotFile,
    folderId: string
  ) {
    const fileName = getSnapshotFileName(config.workspaceId, snapshot.deviceId)
    const existing = await this.getSnapshotFileMetadata(
      drive, config.workspaceId, snapshot.deviceId, folderId
    )

    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(snapshot, (_key, value) =>
        typeof value === 'bigint' ? Number(value) : value
      )
    }

    if (existing?.id) {
      await drive.files.update({ fileId: existing.id, media, fields: 'id' })
      return
    }

    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: 'id'
    })
  }

  async listAllRemoteSnapshotFiles(
    drive: drive_v3.Drive,
    workspaceId: string,
    folderId: string
  ) {
    const safeWs = workspaceId.replace(/[^a-zA-Z0-9._-]/g, '_')
    const searchPrefix = `ecclesia-snapshot-${safeWs}-`
    const result = await drive.files.list({
      q: `name contains '${searchPrefix.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 100
    })
    return result.data.files || []
  }

  async pullAndApplySnapshots(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    appInstanceId: string,
    folderId: string,
    syncService: SyncService
  ) {
    const files = await this.listAllRemoteSnapshotFiles(drive, config.workspaceId, folderId)
    const myDeviceSafe = appInstanceId.replace(/[^a-zA-Z0-9._-]/g, '_')
    const expectedPrefix = `ecclesia-snapshot-${config.workspaceId.replace(/[^a-zA-Z0-9._-]/g, '_')}-`

    let devicesProcessed = 0
    let totalApplied = 0
    let totalStale = 0
    let totalSkipped = 0
    let totalFailed = 0

    for (const fileMeta of files) {
      const fileName = fileMeta.name || ''
      if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue

      const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
      if (!deviceSegment || deviceSegment === myDeviceSafe) continue

      try {
        const response = await drive.files.get(
          { fileId: fileMeta.id || '', alt: 'media' },
          { responseType: 'stream' }
        )
        const raw = await streamToString(response.data as NodeJS.ReadableStream)

        let parsed: any
        try { parsed = JSON.parse(raw) } catch { continue }

        if (!parsed || parsed.schemaVersion !== 1 || parsed.workspaceId !== config.workspaceId) {
          continue
        }
        if (parsed.deviceId === appInstanceId) continue

        const result = await syncService.applySnapshotRows(
          parsed.tables,
          config.workspaceId,
          parsed.deviceId
        )
        totalApplied += result.applied
        totalStale += result.stale
        totalSkipped += result.skipped
        totalFailed += result.failed
        devicesProcessed += 1
      } catch (err) {
        console.error(`[sync] Error procesando snapshot ${fileName}:`, err)
      }
    }

    return { devicesProcessed, applied: totalApplied, stale: totalStale, skipped: totalSkipped, failed: totalFailed }
  }
}

export const syncSnapshotService = new SyncSnapshotService()
