import { OAuth2Client } from 'google-auth-library'
import { google, drive_v3 } from 'googleapis'
import { createHash, randomBytes, randomUUID } from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import {
  getConfigFilePath,
  getTokenFilePath,
  DRIVE_FOLDER_NAME,
  PersistedSyncConfig
} from './sync.config'
import { writeJson, readJsonSafe } from './sync.utils'

const DEFAULT_REDIRECT_URI = 'http://127.0.0.1'

export class DriveClientService {
  private cachedFolderId: string | null = null
  private folderCreationPromise: Promise<string> | null = null

  // Estado pendiente entre getAuthUrl() y exchangeAuthCode()
  private pendingOAuthClient: OAuth2Client | null = null
  private pendingCodeVerifier: string | null = null
  private pendingRedirectUri: string | null = null

  private getClientId(): string {
    return process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_ID || ''
  }

  private getClientSecret(): string {
    return process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_SECRET || ''
  }

  private createOAuthClient(redirectUri?: string): OAuth2Client {
    const clientId = this.getClientId()
    if (!clientId) {
      throw new Error(
        'Falta variable de entorno GOOGLE_DRIVE_CLIENT_ID para OAuth de Google Drive'
      )
    }

    const clientSecret = this.getClientSecret()

    return new OAuth2Client({
      clientId,
      clientSecret: clientSecret || undefined,
      redirectUri: redirectUri || DEFAULT_REDIRECT_URI,
      // Si no hay client_secret, indicamos explícitamente que no se use
      // (PKCE + client_id son suficientes para el flujo OAuth)
      clientAuthentication: clientSecret ? undefined : ('None' as any),
    })
  }

  private generatePKCE(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    return { verifier, challenge }
  }

  getAuthUrl(redirectUri?: string): string {
    this.pendingOAuthClient = this.createOAuthClient(redirectUri)
    this.pendingRedirectUri = redirectUri || DEFAULT_REDIRECT_URI
    const { verifier, challenge } = this.generatePKCE()
    this.pendingCodeVerifier = verifier
    return this.pendingOAuthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      code_challenge: challenge,
      code_challenge_method: 'S256' as any,
    })
  }

  async exchangeAuthCode(code: string): Promise<Record<string, unknown>> {
    if (!this.pendingOAuthClient || !this.pendingCodeVerifier || !this.pendingRedirectUri) {
      throw new Error('No hay una sesión de OAuth pendiente. Llama a getAuthUrl() primero.')
    }

    const tokenResult = await this.pendingOAuthClient.getToken({
      code,
      codeVerifier: this.pendingCodeVerifier,
      redirect_uri: this.pendingRedirectUri,
    })

    // Limpiar estado pendiente
    this.pendingOAuthClient = null
    this.pendingCodeVerifier = null
    this.pendingRedirectUri = null

    return Object.assign({}, tokenResult.tokens) as unknown as Record<string, unknown>
  }

  async getDriveClient(): Promise<{ drive: drive_v3.Drive; config: PersistedSyncConfig }> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const tokens = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())

    if (!config || !tokens) {
      throw new Error('No hay configuración o sesión activa de Google Drive')
    }

    const oauthClient = this.createOAuthClient()
    oauthClient.setCredentials(tokens)

    try {
      if (typeof (oauthClient as any).on === 'function') {
        ;(oauthClient as any).on('tokens', async (newTokens: any) => {
          try {
            const current = (await readJsonSafe<Record<string, unknown>>(getTokenFilePath())) || {}
            await writeJson(getTokenFilePath(), { ...current, ...newTokens })
          } catch { /* No fatal */ }
        })
      }
    } catch { /* test environments */ }

    return { config, drive: google.drive({ version: 'v3', auth: oauthClient }) }
  }

  async getDriveClientFromTokensOnly(): Promise<drive_v3.Drive> {
    const tokens = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
    if (!tokens) throw new Error('No hay sesión activa de Google Drive')
    const oauthClient = this.createOAuthClient()
    oauthClient.setCredentials(tokens)
    return google.drive({ version: 'v3', auth: oauthClient })
  }

  async getOrCreateEcclesiaFolder(drive: drive_v3.Drive): Promise<string> {
    if (this.cachedFolderId) return this.cachedFolderId
    if (this.folderCreationPromise) return this.folderCreationPromise

    this.folderCreationPromise = (async (): Promise<string> => {
      const search = await drive.files.list({
        q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed = false`,
        spaces: 'drive',
        fields: 'files(id)',
        pageSize: 1
      })
      if (search.data.files?.[0]?.id) {
        this.cachedFolderId = search.data.files[0].id
        return this.cachedFolderId!
      }
      const created = await drive.files.create({
        requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
      })
      this.cachedFolderId = created.data.id!
      return this.cachedFolderId!
    })().finally(() => { this.folderCreationPromise = null })

    return this.folderCreationPromise!
  }

  clearCachedFolderId(): void {
    this.cachedFolderId = null
  }

  async revokeToken(): Promise<void> {
    const tokens = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())
    if (tokens?.access_token) {
      try {
        const client = this.createOAuthClient()
        await client.revokeToken(tokens.access_token as string)
      } catch {
        // Best-effort: revocación online no crítica para el cierre local
      }
    }
  }

  clearPendingAuth(): void {
    this.pendingOAuthClient = null
    this.pendingCodeVerifier = null
    this.pendingRedirectUri = null
    this.cachedFolderId = null
  }

  async getOrCreateAppInstanceId(): Promise<string> {
    const instancePath = path.join(path.dirname(getConfigFilePath()), 'app-instance-id.json')
    const existing = await readJsonSafe<{ id: string }>(instancePath)
    if (existing?.id && typeof existing.id === 'string' && existing.id.length > 8) return existing.id
    const newId = randomUUID()
    await fs.ensureDir(path.dirname(instancePath))
    await writeJson(instancePath, { id: newId })
    return newId
  }
}

export const driveClientService = new DriveClientService()
