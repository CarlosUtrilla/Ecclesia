/**
 * Ventana oculta con renderizado offscreen (OSR) que rasteriza diapositivas
 * PPTX a PNG.
 *
 * Carga la ruta `/pptx-render` del propio renderer, donde vive
 * `@aiden0z/pptx-renderer` (la librería pinta a DOM, así que necesita un
 * contexto Chromium). Mismo patrón que `ndiManager/ndiCaptureWindow.ts`.
 *
 * Dos detalles que costaron encontrar y que no se pueden simplificar:
 *
 * 1. `offscreen: true` es obligatorio. Una ventana con `show: false` normal
 *    nunca compone, y `capturePage()` devuelve siempre el mismo frame vacío.
 *    En OSR el evento `paint` sí entrega frames reales sin mostrar nada.
 *
 * 2. Los callbacks de `requestAnimationFrame` corren *antes* del commit al
 *    compositor, así que cuando el renderer avisa de que ya pintó, el último
 *    frame todavía lleva la diapositiva anterior: capturar ahí produce un
 *    desfase de uno, silencioso y sistemático. En vez de adivinar cuántos
 *    frames esperar, pintamos un marcador magenta entre diapositivas y
 *    sondeamos hasta que el centro deja de ser magenta.
 */

import { BrowserWindow, screen, type NativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'
import {
  PPTX_RENDER_LOAD,
  PPTX_RENDER_LOADED,
  PPTX_RENDER_MARKER,
  PPTX_RENDER_MARKERED,
  PPTX_RENDER_RENDERED,
  PPTX_RENDER_ROUTE,
  PPTX_RENDER_SLIDE,
  type PptxLoadedMessage,
  type PptxLoadSuccess,
  type PptxRenderedMessage
} from './pptxRenderTypes'

/** Lee el píxel central de un frame OSR. `getBitmap()` devuelve BGRA. */
function centerRgb(image: NativeImage): [number, number, number] {
  const { width, height } = image.getSize()
  const bitmap = image.getBitmap()
  const offset = ((height >> 1) * width + (width >> 1)) * 4
  return [bitmap[offset + 2], bitmap[offset + 1], bitmap[offset]]
}

function isMarkerColor([r, g, b]: [number, number, number]): boolean {
  return r > 200 && g < 60 && b > 200
}

export type PptxRenderWindowHandle = {
  /** Carga el .pptx y devuelve tamaño y lista de diapositivas. */
  load: (bytes: Buffer) => Promise<PptxLoadSuccess>
  /** Fija el tamaño de captura a partir del tamaño de diapositiva y la escala. */
  resize: (slideWidth: number, slideHeight: number, scale: number) => Promise<void>
  /** Rasteriza una diapositiva y devuelve el PNG ya compuesto. */
  capture: (index: number) => Promise<{ png: Buffer; width: number; height: number }>
  destroy: () => void
}

export type CreatePptxRenderWindowOptions = {
  /** Tiempo máximo esperando a que el compositor entregue el frame correcto. */
  settleTimeoutMs?: number
  /** Tiempo máximo esperando a que el renderer pinte una diapositiva. */
  renderTimeoutMs?: number
}

export async function createPptxRenderWindow({
  settleTimeoutMs = 10_000,
  renderTimeoutMs = 30_000
}: CreatePptxRenderWindowOptions = {}): Promise<PptxRenderWindowHandle> {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
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
  win.webContents.setAudioMuted(true)
  win.webContents.setFrameRate(30)

  let lastFrame: NativeImage | null = null
  let frameSeq = 0
  win.webContents.on('paint', (_event, _dirty, image) => {
    const { width, height } = image.getSize()
    if (width <= 0 || height <= 0) return
    lastFrame = image
    frameSeq += 1
  })

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) log.warn('[pptx][renderer] ' + message)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[pptx] El renderer de la ventana de rasterizado murió:', details.reason)
  })

  const once = <T>(channel: string, timeoutMs: number, what: string): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        win.webContents.ipc.removeAllListeners(channel)
        reject(new Error(`Tiempo agotado esperando ${what}`))
      }, timeoutMs)
      win.webContents.ipc.once(channel, (_e, payload: T) => {
        clearTimeout(timer)
        resolve(payload)
      })
    })

  /** Sondea frames hasta que el centro sea (o deje de ser) el marcador. */
  const settle = async (want: 'marker' | 'slide'): Promise<NativeImage> => {
    const started = Date.now()
    while (Date.now() - started < settleTimeoutMs) {
      const seq = frameSeq
      const waitedFrom = Date.now()
      while (frameSeq === seq && Date.now() - waitedFrom < 500) {
        win.webContents.invalidate()
        await new Promise((r) => setTimeout(r, 16))
      }
      if (lastFrame) {
        const marker = isMarkerColor(centerRgb(lastFrame))
        if (want === 'marker' ? marker : !marker) return lastFrame
      }
    }
    if (!lastFrame) throw new Error('La ventana de rasterizado no produjo ningún frame')
    log.warn(`[pptx] settle(${want}) agotó el tiempo; se usa el último frame disponible`)
    return lastFrame
  }

  const ready = once<void>('pptx-render:ready', renderTimeoutMs, 'que arranque /pptx-render')
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + PPTX_RENDER_ROUTE)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'), { hash: PPTX_RENDER_ROUTE })
  }
  await ready

  return {
    async load(bytes) {
      const loaded = once<PptxLoadedMessage>(PPTX_RENDER_LOADED, renderTimeoutMs, 'el parseo del PPTX')
      win.webContents.send(PPTX_RENDER_LOAD, bytes)
      const info = await loaded
      if (!info.ok) throw new Error(`No se pudo leer el PPTX: ${info.error}`)
      return info
    },

    async resize(slideWidth, slideHeight, scale) {
      // El OSR pinta en píxeles físicos, así que se compensa el scaleFactor
      // para que el bitmap salga exactamente a slideWidth * scale.
      win.setContentSize(
        Math.max(1, Math.round((slideWidth * scale) / scaleFactor)),
        Math.max(1, Math.round((slideHeight * scale) / scaleFactor))
      )
      win.webContents.setZoomFactor(scale / scaleFactor)
      await new Promise((r) => setTimeout(r, 300))
    },

    async capture(index) {
      const markered = once<void>(PPTX_RENDER_MARKERED, renderTimeoutMs, 'el marcador')
      win.webContents.send(PPTX_RENDER_MARKER)
      await markered
      await settle('marker')

      const rendered = once<PptxRenderedMessage>(
        PPTX_RENDER_RENDERED,
        renderTimeoutMs,
        `la diapositiva ${index + 1}`
      )
      win.webContents.send(PPTX_RENDER_SLIDE, index)
      const result = await rendered
      if (result.fatal) {
        throw new Error(`La diapositiva ${index + 1} falló al renderizar: ${result.fatal}`)
      }
      if (result.nodeErrors.length > 0) {
        log.warn(
          `[pptx] La diapositiva ${index + 1} tuvo ${result.nodeErrors.length} nodos con error: ` +
            result.nodeErrors.slice(0, 3).join(' | ')
        )
      }

      const image = await settle('slide')
      const { width, height } = image.getSize()
      return { png: image.toPNG(), width, height }
    },

    destroy() {
      if (win.isDestroyed()) return
      win.webContents.removeAllListeners('paint')
      win.destroy()
    }
  }
}
