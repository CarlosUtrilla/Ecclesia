// =====================
// GESTIÓN DE CANALES IPC PARA RENDERER
// Todo nuevo controlador/canal IPC que se exponga a renderer DEBE agregarse aquí,
// siguiendo la estructura y patrón de seguridad/contextBridge de este archivo.
// Documentar y mantener la API centralizada en este archivo.
// =====================

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeRoutes } from '../../database'
import { RoutesTypes } from '../../database/routeTypes'
import { bibleAPI } from '../main/bibleManager'
import { mediaAPI } from '../main/mediaManager'
import { displayAPI } from '../main/displayManager/displaysMethods'
import { liveMediaAPI } from '../main/liveMediaController/liveMediaAPI'
import { googleDriveSyncAPI } from '../main/googleDriveSyncManager/googleDriveSyncAPI'
import { updaterAPI } from '../main/updaterManager/updaterAPI'
import log from 'electron-log'

// Silenciar el transporte de consola de `electron-log` en el renderer para
// evitar duplicación/volcados masivos en la terminal.
try {
  if (log?.transports?.console) {
    // Desactivar transporte de consola
    log.transports.console.level = false
  }
} catch (e) {
  // No bloquear si `electron-log` no está disponible en este contexto
}

// Funciones adicionales para ventanas
const windowAPI = {
  openSongWindow: (songId?: number) => ipcRenderer.send('open-song-window', songId),
  openThemeWindow: (themeId?: number) => ipcRenderer.send('open-theme-window', themeId),
  openPresentationWindow: (presentationId?: number) =>
    ipcRenderer.send('open-presentation-window', presentationId),
  openTagSongsWindow: () => ipcRenderer.send('open-tag-songs-window'),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  openStageControlWindow: () => ipcRenderer.send('open-stage-control-window'),
  openStageLayoutWindow: () => ipcRenderer.send('open-stage-layout-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window'),
  confirmClose: () => ipcRenderer.send('app-close-confirm'),
  cancelClose: () => ipcRenderer.send('app-close-cancel'),
  skipSyncAndClose: () => ipcRenderer.send('app-close-skip-sync'),
  confirmThemeClose: () => ipcRenderer.send('theme-close-confirm')
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
  liveMediaAPI,
  googleDriveSyncAPI,
  updaterAPI,
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
  window.liveMediaAPI = liveMediaAPI
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
  // @ts-ignore (define in dts)
  window.googleDriveSyncAPI = googleDriveSyncAPI
}
