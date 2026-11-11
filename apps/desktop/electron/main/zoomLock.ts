import { BrowserWindow } from 'electron'

// Teclas que el menú por defecto usa para Acercar / Alejar / Tamaño real.
const ZOOM_KEYS = new Set(['+', '=', '-', '_', '0'])

/**
 * Fija el zoom de la ventana a 100 %.
 *
 * Chromium guarda el zoom por origen (localhost en dev, file:// en prod) en
 * `userData/Preferences` y lo comparte entre TODAS las ventanas de ese origen,
 * así que un Cmd+ accidental o un setZoomFactor en otra ventana agranda toda la
 * app y sobrevive a reinicios. Aquí se resetea al cargar, se bloquean los
 * atajos de teclado y el pellizco del trackpad.
 *
 * Las ventanas offscreen (rasterizado PPTX, captura NDI) se excluyen: controlan
 * su propio zoom y viven en sesiones aisladas.
 */
export function lockWindowZoom(window: BrowserWindow): void {
  const { webContents } = window
  if (webContents.isOffscreen()) return

  webContents.on('did-finish-load', () => {
    webContents.setZoomFactor(1)
    webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined)
  })

  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if ((input.meta || input.control) && ZOOM_KEYS.has(input.key)) event.preventDefault()
  })

  // Ctrl/Cmd + rueda: Electron emite el evento pero no aplica zoom si nadie lo hace.
  webContents.on('zoom-changed', () => webContents.setZoomFactor(1))
}
