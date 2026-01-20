import { ipcRenderer } from 'electron'
import { DisplayInfo } from './displayType'

export const displayAPI = {
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('get-displays'),
  showLiveScreen: (displayId: number): Promise<number> =>
    ipcRenderer.invoke('show-live-screen', displayId),
  closeLiveScreen: (windowId: number): Promise<boolean> =>
    ipcRenderer.invoke('close-live-screen', windowId),
  showNewDisplayConnected: (): Promise<void> => ipcRenderer.invoke('show-new-display-connected')
}
