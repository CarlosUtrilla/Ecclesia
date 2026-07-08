import { RequestHandler } from '../../utils/RequestHandler'
import {
  ExchangeOAuthCodeDTO,
  SyncConfigDTO
} from './sync.dto'
import { driveClientService } from './sync-drive-client.service'
import {
  getConfigFilePath,
  getTokenFilePath,
  getAppInstanceIdFilePath,
  PersistedSyncConfig,
  SyncStatus,
  normalizeConfig
} from './sync.config'
import fs from 'fs-extra'
import os from 'os'
import { readJsonSafe, writeJson } from './sync.utils'
import { getSocket } from '../../sockets/socket.service'
import { oplogService } from '../sync-oplog/oplog.service'
import log from 'electron-log'

function broadcastSyncState(connected: boolean): void {
  try {
    getSocket().emit.syncState({ connected })
  } catch { /* socket no listo */ }
}

function triggerInitialSync(): void {
  // Trigger a sync cycle in the background after Drive is connected.
  // This is fire-and-forget; errors are logged but don't block the OAuth response.
  setImmediate(() => {
    oplogService
      .ensureInitialized()
      .then(() => oplogService.syncCycle())
      .catch((err) => log.warn('[sync] Initial sync after connect failed:', err.message))
  })
}

class SyncController {
  async getStatus(): Promise<SyncStatus> {
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

  async getAuthUrl({ body }: RequestHandler<{ redirectUri?: string }>): Promise<{ authUrl: string }> {
    const authUrl = driveClientService.getAuthUrl(body.redirectUri)
    return { authUrl }
  }

  async exchangeOAuthCode({ body }: RequestHandler<ExchangeOAuthCodeDTO>): Promise<{
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

export default SyncController
