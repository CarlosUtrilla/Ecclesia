import { google, drive_v3 } from 'googleapis'
import fs from 'fs-extra'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  getConfigFilePath,
  getTokenFilePath,
  DRIVE_FOLDER_NAME,
  PersistedSyncConfig
} from './sync.config'
import { writeJson, readJsonSafe } from './sync.utils'

export class DriveClientService {
  private cachedFolderId: string | null = null
  private folderCreationPromise: Promise<string> | null = null

  private getOAuthClient() {
    const clientId =
      process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_ID || ''
    const clientSecret =
      process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.ECCLESIA_GOOGLE_DRIVE_CLIENT_SECRET || ''

    if (!clientId || !clientSecret) {
      throw new Error(
        'Faltan variables de entorno para OAuth de Google Drive: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET'
      )
    }

    return new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')
  }

  getAuthUrl(): string {
    return this.getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file']
    })
  }

  async exchangeAuthCode(code: string): Promise<Record<string, unknown>> {
    const oauthClient = this.getOAuthClient()
    const tokenResult = await oauthClient.getToken(code)
    return Object.assign({}, tokenResult.tokens) as unknown as Record<string, unknown>
  }

  async getDriveClient(): Promise<{ drive: drive_v3.Drive; config: PersistedSyncConfig }> {
    const config = await readJsonSafe<PersistedSyncConfig>(getConfigFilePath())
    const tokens = await readJsonSafe<Record<string, unknown>>(getTokenFilePath())

    if (!config || !tokens) {
      throw new Error('No hay configuración o sesión activa de Google Drive')
    }

    const oauthClient = this.getOAuthClient()
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
    const oauthClient = this.getOAuthClient()
    oauthClient.setCredentials(tokens)
    return google.drive({ version: 'v3', auth: oauthClient })
  }

  async getOrCreateEcclesiaFolder(drive: drive_v3.Drive): Promise<string> {
    if (this.cachedFolderId) return this.cachedFolderId
    if (this.folderCreationPromise) return this.folderCreationPromise

    this.folderCreationPromise = (async () => {
      const search = await drive.files.list({
        q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed = false`,
        spaces: 'drive',
        fields: 'files(id)',
        pageSize: 1
      })
      if (search.data.files?.[0]?.id) {
        this.cachedFolderId = search.data.files[0].id
        return this.cachedFolderId
      }
      const created = await drive.files.create({
        requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
      })
      this.cachedFolderId = created.data.id!
      return this.cachedFolderId
    })().finally(() => { this.folderCreationPromise = null })

    return this.folderCreationPromise
  }

  clearCachedFolderId(): void {
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
