/**
 * Rasterizado de PPTX a PNG, con la misma forma que `pdfToPngBuffers()` de
 * `apps/api/src/pdfConverter.ts` para que la capa de importación pueda tratar
 * ambos formatos igual.
 *
 * Las conversiones se serializan: la ventana offscreen es un recurso único y
 * dos rasterizados a la vez se pisarían.
 */

import { screen } from 'electron'
import fs from 'fs'
import log from 'electron-log'
import { createPptxRenderWindow } from './pptxRenderWindow'
import { resolveRenderScale } from './pptxRenderScale'

export interface RenderedPptxSlide {
  /** 1-indexado, como `RenderedPage.pageNumber` del PDF. */
  pageNumber: number
  pngBuffer: Buffer
  width: number
  height: number
}

let queue: Promise<unknown> = Promise.resolve()

/** Encola `task` detrás de lo que ya haya en curso. */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  // La cola no debe romperse porque una conversión falle.
  queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export async function pptxToPngBuffers(pptxPath: string): Promise<RenderedPptxSlide[]> {
  const bytes = fs.readFileSync(pptxPath)
  return pptxBufferToPngBuffers(bytes)
}

export async function pptxBufferToPngBuffers(bytes: Buffer): Promise<RenderedPptxSlide[]> {
  return serialize(async () => {
    const started = Date.now()
    const win = await createPptxRenderWindow()
    try {
      const info = await win.load(bytes)
      const scale = resolveRenderScale(
        info.width,
        screen.getAllDisplays().map((d) => d.size.width)
      )
      await win.resize(info.width, info.height, scale)

      const slides: RenderedPptxSlide[] = []
      let pageNumber = 0
      for (const slide of info.slides) {
        // PowerPoint no proyecta las diapositivas ocultas; nosotros tampoco.
        if (slide.hidden) continue
        pageNumber += 1
        const { png, width, height } = await win.capture(slide.index)
        slides.push({ pageNumber, pngBuffer: png, width, height })
      }

      log.info(
        `[pptx] Rasterizadas ${slides.length} diapositivas a escala ${scale}x ` +
          `en ${Date.now() - started}ms`
      )
      return slides
    } finally {
      win.destroy()
    }
  })
}
