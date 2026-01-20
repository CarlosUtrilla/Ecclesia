import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'
import { RoutesTypes } from '../../database/routeTypes'
import { bibleAPI } from '../main/bibleManager'
import { mediaAPI } from '../main/mediaManager'
import { displayAPI } from '../main/displayManager/displaysMethods'

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId),
  openThemeWindow: (themeId?: number) => ipcRenderer.send('open-theme-window', themeId),
  openTagSongsWindow: () => ipcRenderer.send('open-tag-songs-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window')
}

// API para obtener fuentes del sistema
const systemAPI = {
  getSystemFonts: (): Promise<string[]> => ipcRenderer.invoke('get-system-fonts')
}

export const HandleManagers = {
  bibleAPI,
  electron: electronAPI,
  mediaAPI,
  systemAPI,
  windowAPI,
  displayAPI,
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
  // @ts-ignore (define in dts)
  window.displayAPI = displayAPI
}
