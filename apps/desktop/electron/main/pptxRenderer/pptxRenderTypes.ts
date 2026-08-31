/**
 * Contrato IPC entre el proceso principal y la ventana offscreen que rasteriza
 * los PPTX (`/pptx-render`). Vive en un archivo aparte porque lo consumen los
 * tres lados: main, preload y renderer.
 */

/** main → renderer */
export const PPTX_RENDER_LOAD = 'pptx-render:load'
export const PPTX_RENDER_MARKER = 'pptx-render:marker'
export const PPTX_RENDER_SLIDE = 'pptx-render:slide'

/** renderer → main */
export const PPTX_RENDER_LOADED = 'pptx-render:loaded'
export const PPTX_RENDER_MARKERED = 'pptx-render:markered'
export const PPTX_RENDER_RENDERED = 'pptx-render:rendered'

/** Ruta del renderer que carga la ventana de rasterizado. */
export const PPTX_RENDER_ROUTE = '/pptx-render'

/**
 * Color del marcador que se pinta entre diapositivas para saber cuándo el
 * compositor ya ha soltado un frame nuevo. Ver `pptxRenderWindow.ts`.
 */
export const PPTX_MARKER_CSS_COLOR = '#ff00ff'

export type PptxSlideInfo = {
  index: number
  /** `p:sld@show="0"`: PowerPoint no la proyecta, nosotros tampoco. */
  hidden: boolean
}

export type PptxLoadFailure = { ok: false; error: string }

export type PptxLoadSuccess = {
  ok: true
  /** Tamaño de la diapositiva en píxeles CSS (960x540, 1280x720...). */
  width: number
  height: number
  slides: PptxSlideInfo[]
}

export type PptxLoadedMessage = PptxLoadFailure | PptxLoadSuccess

export type PptxRenderedMessage = {
  index: number
  /** Nodos que la librería no supo pintar; la diapositiva sigue siendo válida. */
  nodeErrors: string[]
  /** Si viene, la diapositiva entera falló. */
  fatal?: string
}
