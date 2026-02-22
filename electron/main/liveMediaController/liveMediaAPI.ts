// API y tipos para sincronización de media en pantallas en vivo
export type LiveMediaState = { action: 'play' | 'pause' | 'seek' | 'restart'; time: number }

import { ipcRenderer } from 'electron'

/**
 * API para sincronización de media en pantallas en vivo
 * Debe ser importada y expuesta en preload/index.ts
 */
export const liveMediaAPI = {
  /**
   * Suscribirse a cambios de estado de media enviados desde el controlador principal
   * @param callback (state: LiveMediaState) => void
   * @returns función para desuscribirse
   */
  onMediaState: (callback: (state: LiveMediaState) => void) => {
    ipcRenderer.on('live-media-state', (_event, state) => callback(state))
    return () => ipcRenderer.removeAllListeners('live-media-state')
  }
}
