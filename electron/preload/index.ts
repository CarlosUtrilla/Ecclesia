import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', exposeRoutes())
    contextBridge.exposeInMainWorld('windowAPI', windowAPI)
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
}
