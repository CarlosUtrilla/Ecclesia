/**
 * Ventana oculta con renderizado offscreen (OSR) que sirve de fuente de frames
 * para la salida NDI.
 *
 * Carga la misma ruta que la proyección (`/live-screen/ndi`), así recibe los
 * eventos `liveScreen-update` / `liveScreen-update-theme` que `displayManager`
 * hace broadcast a todas las ventanas. Gracias a esto la salida NDI funciona
 * aunque no haya ninguna pantalla física conectada.
 */

import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import type { NdiVideoFrame } from './ndiSender'

/** Ruta del renderer usada por la ventana de captura (displayId no numérico). */
export const NDI_CAPTURE_ROUTE = '/live-screen/ndi'

export type NdiCaptureWindowOptions = {
  width: number
  height: number
  fps: number
  onFrame: (frame: NdiVideoFrame) => void
}

export type NdiCaptureWindowHandle = {
  window: BrowserWindow
  destroy: () => void
}

export function createNdiCaptureWindow({
  width,
  height,
  fps,
  onFrame
}: NdiCaptureWindowOptions): NdiCaptureWindowHandle {
  // El OSR pinta en píxeles físicos: en pantallas Retina (scaleFactor 2) una ventana
  // de 1280x720 produce frames de 2560x1440. Se crea la ventana en píxeles lógicos
  // para que el bitmap resultante sea exactamente la resolución configurada.
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
  const logicalWidth = Math.max(1, Math.round(width / scaleFactor))
  const logicalHeight = Math.max(1, Math.round(height / scaleFactor))

  const captureWindow = new BrowserWindow({
    width: logicalWidth,
    height: logicalHeight,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      offscreen: true
    }
  })

  captureWindow.webContents.setFrameRate(fps)
  captureWindow.webContents.setAudioMuted(true)

  let loggedSizeMismatch = false

  captureWindow.webContents.on('paint', (_event, _dirtyRect, image) => {
    const size = image.getSize()
    if (size.width <= 0 || size.height <= 0) return

    if (!loggedSizeMismatch && (size.width !== width || size.height !== height)) {
      loggedSizeMismatch = true
      log.warn(
        `[ndi] La captura sale a ${size.width}x${size.height} y no a ${width}x${height} ` +
          `(scaleFactor ${scaleFactor}); se emite con el tamaño real`
      )
    }

    // `getBitmap()` devuelve un buffer válido solo dentro del handler: hay que copiarlo.
    onFrame({
      data: Buffer.from(image.getBitmap()),
      width: size.width,
      height: size.height
    })
  })

  captureWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('[ndi] El renderer de la ventana de captura murió:', details.reason)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    captureWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + NDI_CAPTURE_ROUTE)
  } else {
    captureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: NDI_CAPTURE_ROUTE
    })
  }

  return {
    window: captureWindow,
    destroy() {
      if (captureWindow.isDestroyed()) return
      captureWindow.webContents.removeAllListeners('paint')
      captureWindow.destroy()
    }
  }
}
