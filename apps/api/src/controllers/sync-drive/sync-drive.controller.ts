import os from 'os'
import { DriveService } from './drive.service'

export default class SyncDriveController {
  private driveService = new DriveService()

  async getAuthUrl(): Promise<{ url: string }> {
    return { url: this.driveService.getAuthUrl() }
  }

  async setOAuthToken({ body }: { body: Record<string, unknown> }): Promise<{ success: boolean }> {
    await this.driveService.setOAuthToken(body)
    return { success: true }
  }

  async getStatus(): Promise<Record<string, unknown>> {
    const config = await this.driveService.getSyncConfig()
    const token = await this.driveService.getOAuthToken()

    return {
      connected: !!token,
      config: config ?? null,
      hasToken: !!token
    }
  }

  async configure({ body }: { body: Record<string, unknown> }): Promise<{ success: boolean }> {
    await this.driveService.setSyncConfig(body)
    return { success: true }
  }

  async disconnect(): Promise<{ success: boolean }> {
    await this.driveService.removeOAuthToken()
    await this.driveService.removeSyncConfig()
    return { success: true }
  }

  async pushSnapshot(): Promise<{ success: boolean }> {
    const config = await this.driveService.getSyncConfig() as Record<string, unknown> | null
    if (!config?.enabled) return { success: false }

    const drive = await this.driveService.getDriveClient()
    const folderId = await this.driveService.getOrCreateEcclesiaFolder()
    const workspaceId = (config.workspaceId as string) || 'default'
    const deviceName = (config.deviceName as string) || os.hostname() || 'Este dispositivo'

    const snapshot = await this.driveService.buildSnapshot(workspaceId, deviceName)
    await this.driveService.uploadSnapshot(drive, workspaceId, deviceName, snapshot)

    return { success: true }
  }

  async pushMedia(): Promise<{ success: boolean }> {
    const config = await this.driveService.getSyncConfig() as Record<string, unknown> | null
    if (!config?.enabled) return { success: false }

    const drive = await this.driveService.getDriveClient()
    await this.driveService.getOrCreateEcclesiaFolder()

    // TODO: implementar sync de media manifest

    return { success: true }
  }

  async executeSync(): Promise<{ success: boolean }> {
    await this.pushSnapshot()
    return { success: true }
  }
}
