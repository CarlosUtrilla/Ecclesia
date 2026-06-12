import { ipcRenderer } from 'electron'

export interface LanDevice {
  ip: string
  name: string
}

export interface RemoteConnectionState {
  url: string
  port: number
}

export const remoteControlAPI = {
  discoverLan: (): Promise<LanDevice[]> => ipcRenderer.invoke('remote:discover-lan'),
  notifyConnectionChanged: (url: string, port: number): void => {
    ipcRenderer.send('remote:state-changed', { url, port })
  },
  notifyDisconnected: (): void => {
    ipcRenderer.send('remote:disconnected')
  },
  getConnectionState: (): Promise<RemoteConnectionState | null> => {
    return ipcRenderer.invoke('remote:get-connection-state')
  },
  onConnectionChanged: (callback: (state: RemoteConnectionState | null) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: RemoteConnectionState | null): void => callback(state)
    ipcRenderer.on('remote:connection-changed', handler)
    return () => {
      ipcRenderer.removeListener('remote:connection-changed', handler)
    }
  },
  invalidateAllWindows: (): void => {
    ipcRenderer.send('remote:invalidate-all-windows')
  }
}
