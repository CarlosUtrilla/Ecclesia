import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'
import { MediaType } from '@prisma/client'
import { RoutesTypes } from '../../database/routeTypes'
import { DisplayInfo } from '../main/displayManager/displayType'
import { ImportBibleResult } from '../main/bibleManager/bibleManager'

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId),
  openThemeWindow: (themeId?: number) => ipcRenderer.send('open-theme-window', themeId),
  openTagSongsWindow: () => ipcRenderer.send('open-tag-songs-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window')
}

// API para obtener fuentes del sistema
const systemAPI = {
  getSystemFonts: (): Promise<string[]> => ipcRenderer.invoke('get-system-fonts'),
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('get-displays')
}

// API para gestionar biblias
const bibleAPI = {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('bible:select-bible-file'),
  importFiles: (sourcePaths: string | string[]): Promise<ImportBibleResult[]> =>
    ipcRenderer.invoke('bible:import-files', sourcePaths),
  listAvailable: (): Promise<string[]> => ipcRenderer.invoke('bible:list-available'),
  delete: (filename: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('bible:delete', filename)
}

// API para gestionar archivos de medios
const mediaAPI = {
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
    folder?: string
  }> => ipcRenderer.invoke('media:import-file', sourcePath, folder),
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
  convertVideo: (
    filePath: string
  ): Promise<{
    originalPath: string
    convertedPath: string
    success: boolean
  }> => ipcRenderer.invoke('media:convert-video', filePath),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  getServerPort: (): Promise<number> => ipcRenderer.invoke('get-media-server-port'),
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

export const HandleManagers = {
  bibleAPI,
  electron: electronAPI,
  mediaAPI,
  systemAPI,
  windowAPI,
  api: exposeRoutes() as RoutesTypes
}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    Object.entries(HandleManagers).forEach(([key, value]) => {
      contextBridge.exposeInMainWorld(key, value)
    })
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
  window.systemAPI = systemAPI
  // @ts-ignore (define in dts)
  window.bibleAPI = bibleAPI
  // @ts-ignore (define in dts)
  window.mediaAPI = mediaAPI
}
