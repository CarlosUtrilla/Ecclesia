import { ipcRenderer } from 'electron'
import type { NdiOutputConfig } from './ndiConfig'
import type { NdiStatus } from './index'

export const ndiAPI = {
  getStatus: (): Promise<NdiStatus> => ipcRenderer.invoke('ndi:get-status'),
  updateConfig: (config: Partial<NdiOutputConfig>): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:update-config', config),
  start: (): Promise<NdiStatus> => ipcRenderer.invoke('ndi:start'),
  stop: (): Promise<NdiStatus> => ipcRenderer.invoke('ndi:stop'),
  onStatusChanged: (callback: (status: NdiStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: NdiStatus) => callback(status)
    ipcRenderer.on('ndi:status-changed', listener)
    return () => {
      ipcRenderer.removeListener('ndi:status-changed', listener)
    }
  }
}
