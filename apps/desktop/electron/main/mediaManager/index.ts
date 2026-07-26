import { ipcRenderer, webUtils } from 'electron'
import { MediaType } from '@prisma/client'

export async function initializeMediaManager() {
  const { registerMediaHandlers } = await import('./mediaHandlers')
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
    ipcRenderer.invoke('bible:select-bible-file'),
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('media:select-directory'),
  writeFileToDir: (dir: string, fileName: string, content: string): Promise<string> =>
    ipcRenderer.invoke('media:write-file-to-dir', { dir, fileName, content }),
  copyFileToDir: (sourcePath: string, dir: string, fileName: string): Promise<string> =>
    ipcRenderer.invoke('media:copy-file-to-dir', { sourcePath, dir, fileName }),
  saveFile: (
    content: string | undefined,
    defaultName: string,
    sourcePath?: string
  ): Promise<string | null> =>
    ipcRenderer.invoke('media:save-file', { content, defaultName, sourcePath }),
  importPptxFile: (): Promise<unknown> =>
    ipcRenderer.invoke('media:import-pptx-file')
}
