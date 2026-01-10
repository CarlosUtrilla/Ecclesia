import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'
import { MediaType } from '@prisma/client'

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId),
  openThemeWindow: (themeId?: number) => ipcRenderer.send('open-theme-window', themeId),
  openTagSongsWindow: () => ipcRenderer.send('open-tag-songs-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window')
}

// API para obtener fuentes del sistema
const systemAPI = {
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getDisplays: () => ipcRenderer.invoke('get-displays')
}

// API para gestionar archivos de medios
const mediaAPI = {
  selectFiles: (type: MediaType | 'all') => ipcRenderer.invoke('media:select-files', type),
  importFile: (sourcePath: string, folder?: string) =>
    ipcRenderer.invoke('media:import-file', sourcePath, folder),
  getFullPath: (fileName: string) => ipcRenderer.invoke('media:get-full-path', fileName),
  deleteFile: (filePath: string, thumbnail?: string | null) =>
    ipcRenderer.invoke('media:delete-file', filePath, thumbnail),
  createFolder: (folderPath: string) => ipcRenderer.invoke('media:create-folder', folderPath),
  deleteFolder: (folderPath: string) => ipcRenderer.invoke('media:delete-folder', folderPath),
  rename: (oldPath: string, newName: string, isFolder: boolean) =>
    ipcRenderer.invoke('media:rename', oldPath, newName, isFolder),
  listFolders: (parentFolder?: string) => ipcRenderer.invoke('media:list-folders', parentFolder),
  move: (sourcePath: string, targetFolder: string | null, isFolder: boolean) =>
    ipcRenderer.invoke('media:move', sourcePath, targetFolder, isFolder),
  copyFile: (sourcePath: string, targetFolder: string | null, isFolder: boolean) =>
    ipcRenderer.invoke('media:copy-file', sourcePath, targetFolder, isFolder),
  convertVideo: (filePath: string) => ipcRenderer.invoke('media:convert-video', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getServerPort: () => ipcRenderer.invoke('get-media-server-port'),
  onImportProgress: (callback: (data: { progress: number; fileName: string }) => void) => {
    ipcRenderer.on('media:import-progress', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('media:import-progress')
  },
  onConvertProgress: (
    callback: (data: { progress: number; filePath: string; convertedFilePath: string }) => void
  ) => {
    ipcRenderer.on('media:convert-progress', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('media:convert-progress')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', exposeRoutes())
    contextBridge.exposeInMainWorld('windowAPI', windowAPI)
    contextBridge.exposeInMainWorld('systemAPI', systemAPI)
    contextBridge.exposeInMainWorld('mediaAPI', mediaAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.windowAPI = windowAPI
  // @ts-ignore (define in dts)
  // @ts-ignore (define in dts)
  window.mediaAPI = mediaAPI
  // @ts-ignore (define in dts)
  window.systemAPI = systemAPI
}
