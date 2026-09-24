/**
 * API del apuntador de presentación que el preload expone al renderer.
 * Ver `presenterRemoteController.ts` para el reparto de responsabilidades.
 */

import { ipcRenderer } from 'electron'
import {
  PRESENTER_REMOTE_ENABLED,
  PRESENTER_REMOTE_GET_ENABLED,
  PRESENTER_REMOTE_KEY,
  PRESENTER_REMOTE_NAVIGATE,
  PRESENTER_REMOTE_SET_ENABLED,
  type PresenterRemoteDirection
} from './presenterRemoteTypes'

export const presenterRemoteAPI = {
  /** Reenvía la tecla del apuntador recibida por DOM en esta ventana. */
  sendKey: (direction: PresenterRemoteDirection): void => {
    ipcRenderer.send(PRESENTER_REMOTE_KEY, direction)
  },

  /**
   * Habilita los aceleradores globales. Solo lo llama el panel de items-on-live
   * y solo mientras hay contenido en vivo: mientras están puestos, AvPág/RePág
   * dejan de funcionar en el resto del sistema.
   */
  setEnabled: (enabled: boolean): void => {
    ipcRenderer.send(PRESENTER_REMOTE_SET_ENABLED, enabled)
  },

  /** Si hay algo en vivo que navegar ahora mismo. */
  isEnabled: (): Promise<boolean> => ipcRenderer.invoke(PRESENTER_REMOTE_GET_ENABLED),

  /** Se suscribe a los cambios de ese estado. Devuelve la función para soltarlo. */
  onEnabledChange: (callback: (enabled: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => callback(enabled)

    ipcRenderer.on(PRESENTER_REMOTE_ENABLED, listener)

    return () => {
      ipcRenderer.removeListener(PRESENTER_REMOTE_ENABLED, listener)
    }
  },

  /** Se suscribe al comando de navegación. Devuelve la función para soltarlo. */
  onNavigate: (callback: (direction: PresenterRemoteDirection) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, direction: PresenterRemoteDirection) => {
      callback(direction)
    }

    ipcRenderer.on(PRESENTER_REMOTE_NAVIGATE, listener)

    return () => {
      ipcRenderer.removeListener(PRESENTER_REMOTE_NAVIGATE, listener)
    }
  }
}

export type PresenterRemoteAPI = typeof presenterRemoteAPI
