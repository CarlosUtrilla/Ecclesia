import { log } from '../../utils/logger'
import { drive_v3 } from 'googleapis'
import { getPrisma } from '../../prisma'
import {
  SNAPSHOT_MODELS,
  SNAPSHOT_SCHEMA_VERSION,
  getSnapshotFileName,
  PersistedSyncConfig,
  SnapshotFile
} from './sync.config'
import { syncDriveOpsService } from './sync-drive-ops.service'
import { syncProgressService } from './sync-progress.service'
import SyncService from './sync.service'

export class SyncSnapshotService {
  async buildSnapshot(config: PersistedSyncConfig, appInstanceId: string): Promise<SnapshotFile> {
    const prisma = getPrisma()
    const prismaRecord = prisma as unknown as Record<string, unknown>
    const tables: Record<string, unknown[]> = {}

    for (const model of SNAPSHOT_MODELS) {
      const delegate = prismaRecord[model.delegateName] as
        | { findMany: () => Promise<unknown[]> }
        | undefined
      if (!delegate?.findMany) continue
      log.warn(`[sync] Exportando tabla ${model.modelName}...`)
      tables[model.modelName] = await delegate.findMany()
    }

    const totalRows = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0)
    log.warn(`[sync] Snapshot construido: ${Object.keys(tables).length} tablas, ${totalRows} filas totales`)

    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      workspaceId: config.workspaceId,
      deviceId: appInstanceId,
      updatedAt: new Date().toISOString(),
      tables
    }
  }

  async uploadSnapshot(
    drive: drive_v3.Drive,
    config: PersistedSyncConfig,
    snapshot: SnapshotFile,
    folderId: string
  ) {
    const fileName = getSnapshotFileName(config.workspaceId, snapshot.deviceId)
    await syncDriveOpsService.upsertFile(drive, folderId, fileName, snapshot)
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
    log.warn(`[sync] Encontrados ${files.length} archivos snapshot remotos`)
    const myDeviceSafe = appInstanceId.replace(/[^a-zA-Z0-9._-]/g, '_')
    const expectedPrefix = `ecclesia-snapshot-${config.workspaceId.replace(/[^a-zA-Z0-9._-]/g, '_')}-`

    let devicesProcessed = 0
    let totalApplied = 0
    let totalStale = 0
    let totalSkipped = 0
    let totalFailed = 0

    for (const [index, fileMeta] of files.entries()) {
      const fileName = fileMeta.name || ''
      if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.json')) continue

      const deviceSegment = fileName.slice(expectedPrefix.length, -'.json'.length)
      if (!deviceSegment || deviceSegment === myDeviceSafe) continue

      syncProgressService.setMessage(`Aplicando snapshot de ${deviceSegment} (${index + 1}/${files.length})...`)

      try {
        const raw = await syncDriveOpsService.downloadFileContent(drive, fileMeta.id || '')
        log.warn(`[sync] Descargado snapshot: ${fileName}`)

        let parsed: any
        try { parsed = JSON.parse(raw) } catch { continue }

        if (!parsed || parsed.schemaVersion !== 1 || parsed.workspaceId !== config.workspaceId) continue
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
        log.warn(`[sync] Snapshot ${fileName}: ${result.applied} aplicadas, ${result.stale} obsoletas, ${result.failed} fallos`)
      } catch (err) {
        log.error(`[sync] Error procesando snapshot ${fileName}:`, err)
      }
    }

    log.warn(`[sync] Pull de snapshots completado: ${devicesProcessed} dispositivos, ${totalApplied} filas aplicadas`)
    return { devicesProcessed, applied: totalApplied, stale: totalStale, skipped: totalSkipped, failed: totalFailed }
  }
}

export const syncSnapshotService = new SyncSnapshotService()
