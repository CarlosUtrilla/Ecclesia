import { ipcRenderer, webUtils } from 'electron'
import { registerMediaHandlers } from './mediaHandlers'
import { startMediaServer } from './mediaServer'
import { MediaType } from '@prisma/client'

export function initializeMediaManager() {
  // Iniciar servidor de medios
  startMediaServer()
  // Registrar handlers de medios
  registerMediaHandlers()
}

// API para gestionar archivos de medios
export const mediaAPI = {
  selectFiles: (type: MediaType | 'all'): Promise<string[]> =>
    ipcRenderer.invoke('media:select-files', type),
  importFile: (
    sourcePath: string,
    folder?: string
  ): Promise<{
    name: string
    type: MediaType
    format: string
    filePath: string
    fileSize: number
    thumbnail?: string
    fallback?: string
    folder?: string
  }> => ipcRenderer.invoke('media:import-file', sourcePath, folder),
  importClipboardImage: (
    bytes: number[],
    mimeType: string,
    folder?: string
  ): Promise<{
    name: string
    type: MediaType
    format: string
    filePath: string
    fileSize: number
    thumbnail?: string
    fallback?: string
    folder?: string
  }> => ipcRenderer.invoke('media:import-clipboard-image', bytes, mimeType, folder),
  getFullPath: (fileName: string): Promise<string> =>
    ipcRenderer.invoke('media:get-full-path', fileName),
  deleteFile: (filePath: string, thumbnail?: string | null): Promise<boolean> =>
    ipcRenderer.invoke('media:delete-file', filePath, thumbnail),
  createFolder: (folderPath: string): Promise<{ success: boolean; path: string }> =>
    ipcRenderer.invoke('media:create-folder', folderPath),
  deleteFolder: (folderPath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('media:delete-folder', folderPath),
  rename: (
    oldPath: string,
    newName: string,
    isFolder: boolean
  ): Promise<{ success: boolean; newPath: string }> =>
    ipcRenderer.invoke('media:rename', oldPath, newName, isFolder),
  listFolders: (parentFolder?: string): Promise<string[]> =>
    ipcRenderer.invoke('media:list-folders', parentFolder),
  move: (
    sourcePath: string,
    targetFolder: string | null,
    isFolder: boolean
  ): Promise<{ success: boolean; newPath: string }> =>
    ipcRenderer.invoke('media:move', sourcePath, targetFolder, isFolder),
  copyFile: (
    sourcePath: string,
    targetFolder: string | null,
    isFolder: boolean
  ): Promise<{
    success: boolean
    newPath: string
    newFileName: string
    newThumbnail?: string
  }> => ipcRenderer.invoke('media:copy-file', sourcePath, targetFolder, isFolder),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  extractZipMp4: (zipPath: string): Promise<{ tempDir: string; mp4Paths: string[] }> =>
    ipcRenderer.invoke('media:extract-zip-mp4', zipPath),
  cleanupTempPath: (targetPath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('media:cleanup-temp-path', targetPath),
  getServerPort: (): Promise<number> => ipcRenderer.invoke('get-media-server-port'),
  onImportProgress: (callback: (data: { progress: number; fileName: string }) => void) => {
    ipcRenderer.on('media:import-progress', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('media:import-progress')
  }
}
