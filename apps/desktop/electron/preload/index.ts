// =====================
// GESTIÓN DE CANALES IPC PARA RENDERER
// Todo nuevo controlador/canal IPC que se exponga a renderer DEBE agregarse aquí,
// siguiendo la estructura y patrón de seguridad/contextBridge de este archivo.
// Documentar y mantener la API centralizada en este archivo.
// =====================

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { mediaAPI } from '../main/mediaManager'
import { displayAPI } from '../main/displayManager/displaysMethods'
import { liveMediaAPI } from '../main/liveMediaController/liveMediaAPI'

import { updaterAPI } from '../main/updaterManager/updaterAPI'
import { remoteControlAPI } from '../main/remoteAPI'
import { bibleSearchAPI } from '../main/bibleSearchAPI'
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
  openSettingsWindow: (section?: string) => ipcRenderer.send('open-settings-window', section),
  openStageControlWindow: () => ipcRenderer.send('open-stage-control-window'),
  openOAuthWindow: () => ipcRenderer.send('open-oauth-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  confirmClose: () => ipcRenderer.send('app-close-confirm'),
  cancelClose: () => ipcRenderer.send('app-close-cancel'),
  skipSyncAndClose: () => ipcRenderer.send('app-close-skip-sync'),
  confirmThemeClose: () => ipcRenderer.send('theme-close-confirm'),
  confirmPresentationClose: () => ipcRenderer.send('presentation-close-confirm'),
  triggerClose: () => ipcRenderer.send('window:trigger-close')
}

export const HandleManagers = {
  electron: electronAPI,
  mediaAPI,
  windowAPI,
  displayAPI,
  liveMediaAPI,
  updaterAPI,
  remoteControlAPI,
  bibleSearchAPI
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
  window.windowAPI = windowAPI
  // @ts-ignore (define in dts)
  window.mediaAPI = mediaAPI
  // @ts-ignore (define in dts)
  window.displayAPI = displayAPI
  // @ts-ignore (define in dts)
  window.remoteControlAPI = remoteControlAPI
  // @ts-ignore (define in dts)
  window.bibleSearchAPI = bibleSearchAPI
}
