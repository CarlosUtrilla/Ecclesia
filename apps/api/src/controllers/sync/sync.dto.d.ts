export interface ExchangeOAuthCodeDTO {
  code: string
}

export interface SyncConfigDTO {
  appId?: string
  appSecret?: string
  workspaceId?: string
  deviceName?: string
  enabled?: boolean
  redirectUri?: string
}
