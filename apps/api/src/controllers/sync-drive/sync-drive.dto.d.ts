export type SyncDriveConfig = {
  enabled: boolean
  workspaceId: string
  deviceName: string
  conflictStrategy: 'lastWriteWins' | 'askBeforeOverwrite' | 'primaryDevice'
  primaryDeviceName?: string
  autoOnStart: boolean
  autoEvery5Min: boolean
  autoOnSave: boolean
  autoOnClose: boolean
}

export type SyncDriveStatus = {
  connected: boolean
  accountEmail?: string
  pendingRestore: boolean
  workspaceId?: string
  deviceName?: string
  nextRunAt?: string
  lastRunAt?: string
  lastRunStatus?: 'ok' | 'error'
  lastRunError?: string
  syncProgress?: { syncing: boolean; progress: number }
}

export type OAuthTokenDTO = {
  access_token: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expiry_date?: number
}
