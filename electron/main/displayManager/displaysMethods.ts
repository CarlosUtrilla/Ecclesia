import { ipcRenderer } from 'electron'
import { DisplayInfo, ScreenContentUpdate } from './displayType'
import { ThemeWithMedia } from '../../../database/controllers/themes/themes.dto'

export const displayAPI = {
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('get-displays'),
  showLiveScreen: (displayId: number): Promise<number> =>
    ipcRenderer.invoke('show-live-screen', displayId),
  closeLiveScreen: (windowId: number): Promise<boolean> =>
    ipcRenderer.invoke('close-live-screen', windowId),
  showNewDisplayConnected: (): Promise<void> => ipcRenderer.invoke('show-new-display-connected'),
  updateLiveScreenContent: (data: ScreenContentUpdate) =>
    ipcRenderer.invoke('liveScreen-update', data),
  updateLiveScreenTheme: (theme: ThemeWithMedia) =>
    ipcRenderer.invoke('liveScreen-update-theme', theme),
  handleHideLiveScreen: (): Promise<void> => ipcRenderer.invoke('hide-live-screen')
}
