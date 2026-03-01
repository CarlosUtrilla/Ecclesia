import { ipcRenderer } from 'electron'

type GoogleDriveSyncConfig = {
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

export const googleDriveSyncAPI = {
  getStatus: () => ipcRenderer.invoke('sync:google-drive:status'),
  configure: (config: GoogleDriveSyncConfig) => ipcRenderer.invoke('sync:google-drive:configure', config),
  connect: (config: GoogleDriveSyncConfig) => ipcRenderer.invoke('sync:google-drive:connect', config),
  disconnect: () => ipcRenderer.invoke('sync:google-drive:disconnect'),
  pushNow: () => ipcRenderer.invoke('sync:google-drive:push'),
  pullNow: () => ipcRenderer.invoke('sync:google-drive:pull'),
  notifyAutoSaveEvent: () => ipcRenderer.send('sync:google-drive:auto-save-event'),
  onSyncStateChange: (callback: (data: { syncing: boolean; progress: number }) => void) => {
    const listener = (_event: unknown, data: { syncing: boolean; progress: number }) => callback(data)
    ipcRenderer.on('sync-state', listener)
    return () => ipcRenderer.removeListener('sync-state', listener)
  }
}
