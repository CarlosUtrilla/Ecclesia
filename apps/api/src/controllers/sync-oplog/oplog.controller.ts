import os from 'os'
import fs from 'fs-extra'
import { oplogService } from './oplog.service'
import { oplogMigrationService } from './oplog-migration.service'
import { oplogStateService } from './oplog-state.service'
import { computeSchemaHash } from './oplog-utils'
import { getSocket } from '../../sockets/socket.service'
import type { SyncCycleResult, SyncProgress } from './oplog.types'
import {
  driveClientService
} from './oplog-drive-client.service'
import {
  getConfigFilePath,
  getTokenFilePath,
  getAppInstanceIdFilePath,
  PersistedSyncConfig,
  SyncStatus,
  normalizeConfig,
  readJsonSafe,
  writeJson
} from './oplog-shared'

function broadcastSyncState(connected: boolean): void {
  try {
    getSocket().emit.syncState({ connected })
  } catch { /* socket no listo */ }
}

function triggerInitialSync(): void {
  setImmediate(() => {
    oplogService
      .ensureInitialized()
      .then(() => oplogService.syncCycle())
      .catch((err) => {
        const log = require('electron-log').default
        log.warn('[sync] Initial sync after connect failed:', err.message)
      })
  })
}

export class OplogController {
  // --- Oplog core methods ---

  async init({ body }: { body: { deviceId: string } }): Promise<{ ok: boolean }> {
    await oplogService.init(body.deviceId)
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

  async bootstrap({ body }: { body: { deviceId: string } }): Promise<{ ok: boolean; source: 'local' | 'remote' }> {
    const source = await oplogMigrationService.performFullMigration(body.deviceId)
    await oplogService.init(body.deviceId)

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

  async purge({ body }: { body?: { retentionDays?: number } } = {}): Promise<{
    purged: Record<string, number>
    totalPurged: number
  }> {
    return oplogService.purge(body?.retentionDays)
  }

  // --- OAuth / Drive connection methods ---

  async getSyncStatus(): Promise<SyncStatus> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const token = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())

    const hostname = os.hostname()
    const status: SyncStatus = {
      connected: !!token,
      pendingRestore: false,
      workspaceId: config?.workspaceId || 'default',
      deviceName: config?.deviceName || hostname,
      systemHostname: hostname,
    }

    if (token?.email) status.accountEmail = token.email as string
    if (token?.name) status.accountName = token.name as string

    return status
  }

  async configure({ body }: { body: Record<string, unknown> }): Promise<void> {
    const existing = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const normalized = normalizeConfig(body as Partial<import('./oplog-shared').GoogleDriveSyncConfig>)
    const merged: PersistedSyncConfig = {
      ...existing,
      ...normalized,
      updatedAt: new Date().toISOString()
    }
    await writeJson(getConfigFilePath(), merged)
  }

  async connect({ body }: { body: Record<string, unknown> }): Promise<{ authUrl: string }> {
    const normalized = normalizeConfig(body as Partial<import('./oplog-shared').GoogleDriveSyncConfig>)
    const config: PersistedSyncConfig = {
      ...normalized,
      updatedAt: new Date().toISOString()
    }
    await writeJson(getConfigFilePath(), config)
    const authUrl = driveClientService.getAuthUrl()
    return { authUrl }
  }

  async disconnect(): Promise<void> {
    await driveClientService.revokeToken()

    await Promise.allSettled([
      fs.remove(getTokenFilePath()),
      fs.remove(getAppInstanceIdFilePath())
    ])

    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    if (config) {
      config.enabled = false
      await writeJson(getConfigFilePath(), config)
    }

    driveClientService.clearPendingAuth()
    broadcastSyncState(false)
  }

  async getAuthUrl({ body }: { body: { redirectUri?: string } }): Promise<{ authUrl: string }> {
    const authUrl = driveClientService.getAuthUrl(body.redirectUri)
    return { authUrl }
  }

  async exchangeOAuthCode({ body }: { body: { code: string } }): Promise<{
    success: boolean
    email?: string
  }> {
    const tokens = await driveClientService.exchangeAuthCode(body.code)
    await writeJson(getTokenFilePath(), tokens)
    broadcastSyncState(true)
    triggerInitialSync()
    return { success: true, email: tokens.email as string | undefined }
  }
}

export const oplogController = new OplogController()
