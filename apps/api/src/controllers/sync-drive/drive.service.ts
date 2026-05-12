import { google, drive_v3 } from 'googleapis'
import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import os from 'os'
import { getUserDataPath } from '../../config'

const SYNC_CONFIG_DIR = 'sync'
const CONFIG_FILE = 'google-drive-config.json'
const TOKEN_FILE = 'google-drive-token.json'
const SYNC_STATE_FILE = 'google-drive-sync-state.json'
const APP_INSTANCE_FILE = 'app-instance-id.json'
const ECCLESIA_DRIVE_FOLDER = 'Ecclesia'
const SNAPSHOT_MODELS = [
  'TagSongs', 'Song', 'Lyrics', 'Font', 'BiblePresentationSettings',
  'Media', 'Themes', 'Setting', 'Presentation', 'Schedule',
  'ScheduleGroupTemplate', 'ScheduleItem', 'SelectedScreens', 'StageScreenConfig'
]

export class DriveService {
  private drive: drive_v3.Drive | null = null
  private ecclesiaFolderId: string | null = null

  private getSyncDir(): string {
    return path.join(getUserDataPath(), SYNC_CONFIG_DIR)
  }

  private getConfigPath(): string {
    return path.join(this.getSyncDir(), CONFIG_FILE)
  }

  private getTokenPath(): string {
    return path.join(this.getSyncDir(), TOKEN_FILE)
  }

  private getStatePath(): string {
    return path.join(this.getSyncDir(), SYNC_STATE_FILE)
  }

  private getAppInstancePath(): string {
    return path.join(this.getSyncDir(), APP_INSTANCE_FILE)
  }

  async readConfig<T>(filePath: string): Promise<T | null> {
    try {
      if (!(await fs.pathExists(filePath))) return null
      return (await fs.readJSON(filePath)) as T
    } catch {
      return null
    }
  }

  async writeConfig<T>(filePath: string, data: T): Promise<void> {
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeJSON(filePath, data, { spaces: 2 })
  }

  private getOAuthClient() {
    const clientId = process.env['GOOGLE_DRIVE_CLIENT_ID']
    const clientSecret = process.env['GOOGLE_DRIVE_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new Error(
        'Faltan variables de entorno para OAuth: GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET'
      )
    }

    return new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')
  }

  getAuthUrl(): string {
    const oauthClient = this.getOAuthClient()
    return oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    })
  }

  async setOAuthToken(token: Record<string, unknown>): Promise<void> {
    await this.writeConfig(this.getTokenPath(), {
      ...token,
      updatedAt: new Date().toISOString()
    })
  }

  async getOAuthToken(): Promise<Record<string, unknown> | null> {
    return this.readConfig<Record<string, unknown>>(this.getTokenPath())
  }

  async removeOAuthToken(): Promise<void> {
    const tokenPath = this.getTokenPath()
    if (await fs.pathExists(tokenPath)) {
      await fs.remove(tokenPath)
    }
  }

  async getDriveClient(): Promise<drive_v3.Drive> {
    if (this.drive) return this.drive

    const token = await this.getOAuthToken()
    if (!token) throw new Error('No hay token de OAuth')

    const oauthClient = this.getOAuthClient()
    oauthClient.setCredentials(token as unknown as typeof oauthClient['credentials'])

    oauthClient.on('tokens', async (newTokens) => {
      const currentToken = await this.getOAuthToken()
      await this.setOAuthToken({ ...currentToken, ...newTokens })
    })

    this.drive = google.drive({ version: 'v3', auth: oauthClient })
    return this.drive
  }

  async getOrCreateEcclesiaFolder(): Promise<string> {
    if (this.ecclesiaFolderId) return this.ecclesiaFolderId

    const drive = await this.getDriveClient()

    const search = await drive.files.list({
      q: `name='${ECCLESIA_DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'appDataFolder'
    })

    if (search.data.files && search.data.files.length > 0) {
      this.ecclesiaFolderId = search.data.files[0].id!
      return this.ecclesiaFolderId
    }

    const created = await drive.files.create({
      requestBody: {
        name: ECCLESIA_DRIVE_FOLDER,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['appDataFolder']
      },
      fields: 'id'
    })

    this.ecclesiaFolderId = created.data.id!
    return this.ecclesiaFolderId
  }

  async getOrCreateAppInstanceId(): Promise<string> {
    const existing = await this.readConfig<{ id: string }>(this.getAppInstancePath())
    if (existing?.id) return existing.id

    const id = randomUUID()
    await this.writeConfig(this.getAppInstancePath(), { id })
    return id
  }

  async buildSnapshot(workspaceId: string, deviceName: string): Promise<Record<string, unknown[]>> {
    const { getPrisma } = await import('../../prisma')
    const prisma = getPrisma()
    const snapshot: Record<string, unknown[]> = {}

    for (const model of SNAPSHOT_MODELS) {
      try {
        const delegate = (prisma as unknown as Record<string, unknown>)[model.charAt(0).toLowerCase() + model.slice(1)]
        if (delegate && typeof (delegate as { findMany: () => Promise<unknown[]> }).findMany === 'function') {
          snapshot[model] = await (delegate as { findMany: () => Promise<unknown[]> }).findMany()
        }
      } catch {
        snapshot[model] = []
      }
    }

    return snapshot
  }

  async uploadSnapshot(
    drive: drive_v3.Drive,
    workspaceId: string,
    deviceName: string,
    snapshot: Record<string, unknown[]>
  ): Promise<void> {
    const appInstanceId = await this.getOrCreateAppInstanceId()
    const folderId = await this.getOrCreateEcclesiaFolder()

    const fileName = `ecclesia-snapshot-${workspaceId}-${deviceName}.json`
    const body = JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      appInstanceId,
      deviceName,
      workspaceId,
      models: snapshot
    })

    const existing = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'appDataFolder'
    })

    const media = { mimeType: 'application/json', body: Buffer.from(body) }

    if (existing.data.files && existing.data.files.length > 0) {
      await drive.files.update({
        fileId: existing.data.files[0].id!,
        media,
        fields: 'id'
      })
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media,
        fields: 'id'
      })
    }
  }

  async getSyncConfig(): Promise<Record<string, unknown> | null> {
    return this.readConfig<Record<string, unknown>>(this.getConfigPath())
  }

  async setSyncConfig(config: Record<string, unknown>): Promise<void> {
    await this.writeConfig(this.getConfigPath(), {
      ...config,
      updatedAt: new Date().toISOString()
    })
  }

  async removeSyncConfig(): Promise<void> {
    const configPath = this.getConfigPath()
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath)
    }
  }
}

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
