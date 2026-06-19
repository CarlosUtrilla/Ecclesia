import { ipcRenderer, webUtils } from 'electron'
import { registerMediaHandlers } from './mediaHandlers'
import { MediaType } from '@ecclesia/api'

export function initializeMediaManager() {
  registerMediaHandlers()
}

export const mediaAPI = {
  selectFiles: (
    type: MediaType | 'all'
  ): Promise<{ fileName: string; bytes: Uint8Array; fileSize: number }[]> =>
    ipcRenderer.invoke('media:select-files', type),
  getServerPort: (): Promise<number> => ipcRenderer.invoke('get-media-server-port'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  selectBibleFiles: (): Promise<{ fileName: string; bytes: number[]; fileSize: number }[]> =>
    ipcRenderer.invoke('bible:select-bible-file')
}
