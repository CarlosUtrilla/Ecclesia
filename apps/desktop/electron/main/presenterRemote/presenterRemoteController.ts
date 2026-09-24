/**
 * Apuntador de presentación: AvPág/RePág mueven la diapositiva en vivo sin
 * depender de qué panel (ni qué ventana) tenga el foco.
 *
 * Son dos caminos que acaban en el mismo canal (`presenter-remote:navigate`,
 * siempre hacia la ventana principal, donde vive el panel de items-on-live):
 *
 * 1. **Ecclesia tiene el foco.** Cada ventana escucha la tecla en el DOM
 *    (`usePresenterRemoteKeys`) y la reenvía por `presenter-remote:key`. Así
 *    escribir en un editor sigue funcionando: el hook ignora la tecla cuando
 *    el foco está en un campo de texto.
 *
 * 2. **El foco está en otra aplicación** (las notas del predicador, un PDF...).
 *    Ahí no llega ningún evento de DOM, así que se registran aceleradores
 *    globales. Se registran *solo* en ese caso y solo mientras hay algo en
 *    vivo: un acelerador global secuestra la tecla para todo el sistema, y
 *    dejarlo puesto rompería el scroll con AvPág/RePág en cualquier programa.
 */

import { app, BrowserWindow, globalShortcut } from 'electron'
import log from 'electron-log'
import { getMainWindow } from '../windowManager'
import { handleIpc, onIpc } from '../ipcHelpers'
import {
  PRESENTER_REMOTE_ACCELERATORS,
  PRESENTER_REMOTE_ENABLED,
  PRESENTER_REMOTE_GET_ENABLED,
  PRESENTER_REMOTE_KEY,
  PRESENTER_REMOTE_NAVIGATE,
  PRESENTER_REMOTE_SET_ENABLED,
  type PresenterRemoteDirection
} from './presenterRemoteTypes'

/** Hay algo en vivo que navegar: lo dice el panel de items-on-live. */
let hasLiveContent = false
/** Si los aceleradores globales están puestos ahora mismo. */
let registered = false

function sendNavigate(direction: PresenterRemoteDirection): void {
  const mainWindow = getMainWindow()
  if (!mainWindow) return
  mainWindow.webContents.send(PRESENTER_REMOTE_NAVIGATE, direction)
}

/**
 * Las ventanas necesitan saber si el apuntador está armado para decidir si se
 * quedan con la tecla: si no hay nada en vivo, AvPág/RePág deben seguir
 * desplazando las listas como siempre.
 */
function broadcastEnabled(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(PRESENTER_REMOTE_ENABLED, hasLiveContent)
  }
}

function isAnyWindowFocused(): boolean {
  return BrowserWindow.getAllWindows().some((win) => !win.isDestroyed() && win.isFocused())
}

function unregister(): void {
  if (!registered) return
  for (const accelerator of Object.keys(PRESENTER_REMOTE_ACCELERATORS)) {
    globalShortcut.unregister(accelerator)
  }
  registered = false
}

function register(): void {
  if (registered) return
  for (const [accelerator, direction] of Object.entries(PRESENTER_REMOTE_ACCELERATORS)) {
    const ok = globalShortcut.register(accelerator, () => sendNavigate(direction))
    // Otra aplicación puede tener la tecla tomada. No es fatal: dentro de
    // Ecclesia el camino de DOM sigue funcionando.
    if (!ok) log.warn(`[presenter-remote] No se pudo registrar el acelerador global ${accelerator}`)
  }
  registered = true
}

function syncShortcuts(): void {
  if (hasLiveContent && !isAnyWindowFocused()) register()
  else unregister()
}

/**
 * El cambio de foco entre dos ventanas de Ecclesia emite `blur` y después
 * `focus`. Evaluar en el `blur` daría un registro/desregistro innecesario por
 * cada salto entre ventanas, así que se espera a que el foco se asiente.
 */
function scheduleSync(): void {
  setTimeout(syncShortcuts, 50)
}

export function initializePresenterRemoteManager(): void {
  onIpc(PRESENTER_REMOTE_KEY, (direction: PresenterRemoteDirection) => {
    if (!hasLiveContent) return
    sendNavigate(direction)
  })

  onIpc(PRESENTER_REMOTE_SET_ENABLED, (enabled: boolean) => {
    if (hasLiveContent === enabled) return
    hasLiveContent = enabled
    syncShortcuts()
    broadcastEnabled()
  })

  // Una ventana abierta después del último cambio se perdería el broadcast.
  handleIpc(PRESENTER_REMOTE_GET_ENABLED, () => hasLiveContent)

  app.on('browser-window-focus', scheduleSync)
  app.on('browser-window-blur', scheduleSync)
  app.on('will-quit', unregister)
}
