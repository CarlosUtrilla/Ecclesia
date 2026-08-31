/**
 * API que el preload expone a la ventana `/pptx-render`.
 *
 * Es la única ventana que la usa, y sólo habla con `pptxRenderWindow.ts`.
 */

import { ipcRenderer } from 'electron'
import {
  PPTX_RENDER_LOAD,
  PPTX_RENDER_LOADED,
  PPTX_RENDER_MARKER,
  PPTX_RENDER_MARKERED,
  PPTX_RENDER_RENDERED,
  PPTX_RENDER_SLIDE,
  type PptxLoadedMessage,
  type PptxRenderedMessage
} from './pptxRenderTypes'

export const pptxRenderAPI = {
  onLoad: (cb: (bytes: Uint8Array) => void) => {
    const h = (_e: unknown, bytes: Uint8Array) => cb(bytes)
    ipcRenderer.on(PPTX_RENDER_LOAD, h)
    return () => ipcRenderer.removeListener(PPTX_RENDER_LOAD, h)
  },
  onMarker: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on(PPTX_RENDER_MARKER, h)
    return () => ipcRenderer.removeListener(PPTX_RENDER_MARKER, h)
  },
  onRenderSlide: (cb: (index: number) => void) => {
    const h = (_e: unknown, index: number) => cb(index)
    ipcRenderer.on(PPTX_RENDER_SLIDE, h)
    return () => ipcRenderer.removeListener(PPTX_RENDER_SLIDE, h)
  },
  sendLoaded: (msg: PptxLoadedMessage) => ipcRenderer.send(PPTX_RENDER_LOADED, msg),
  sendMarkered: () => ipcRenderer.send(PPTX_RENDER_MARKERED),
  sendRendered: (msg: PptxRenderedMessage) => ipcRenderer.send(PPTX_RENDER_RENDERED, msg)
}

export type PptxRenderAPI = typeof pptxRenderAPI
