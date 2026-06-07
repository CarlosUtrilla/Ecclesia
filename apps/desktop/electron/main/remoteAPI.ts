import { ipcRenderer } from 'electron'

export interface LanDevice {
  ip: string
  name: string
}

export const remoteControlAPI = {
  discoverLan: (): Promise<LanDevice[]> => ipcRenderer.invoke('remote:discover-lan')
}
