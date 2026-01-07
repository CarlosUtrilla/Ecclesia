import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId),
  openThemeWindow: (themeId?: number) => ipcRenderer.send('open-theme-window', themeId)
}

// API para obtener fuentes del sistema
const systemAPI = {
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getDisplays: () => ipcRenderer.invoke('get-displays')
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
}
