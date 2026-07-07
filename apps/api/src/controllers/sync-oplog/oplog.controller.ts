import { oplogService } from './oplog.service'
import { oplogMigrationService } from './oplog-migration.service'
import { oplogStateService } from './oplog-state.service'
import { computeSchemaHash } from './oplog-utils'
import { getSocket } from '../../sockets/socket.service'
import type { SyncCycleResult, SyncProgress } from './oplog.types'

export class OplogController {
  async init(data: { deviceId: string }): Promise<{ ok: boolean }> {
    await oplogService.init(data.deviceId)
    return { ok: true }
  }

  async getStatus(): Promise<{
    initialized: boolean
    schemaHash: string
    lastSyncAt: string | null
    deviceId: string | null
  }> {
    const config = await oplogStateService.readConfig()
    return {
      initialized: config !== null,
      schemaHash: computeSchemaHash(),
      lastSyncAt: config?.lastSyncAt ?? null,
      deviceId: config?.deviceId ?? null,
    }
  }

  async bootstrap(data: { deviceId: string }): Promise<{ ok: boolean; source: 'local' | 'remote' }> {
    const source = await oplogMigrationService.performFullMigration(data.deviceId)
    await oplogService.init(data.deviceId)

    if (source === 'remote' && oplogService.isInitialized) {
      await oplogService.syncCycle()
    }

    return { ok: true, source }
  }

  async syncCycle(): Promise<SyncCycleResult> {
    oplogService.setOnProgress((p: SyncProgress) => {
      try {
        getSocket().emit.syncProgress({ progress: p.progress, message: p.message })
      } catch { /* socket no listo */ }
    })
    try {
      return await oplogService.syncCycle()
    } finally {
      oplogService.setOnProgress(null)
    }
  }

  async pull(): Promise<{ newEventsCount: number }> {
    const result = await oplogService.pull()
    return { newEventsCount: result.newEventsCount }
  }

  async push(): Promise<{ pushed: number }> {
    return oplogService.push()
  }
}

export const oplogController = new OplogController()
