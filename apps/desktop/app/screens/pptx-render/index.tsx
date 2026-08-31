/**
 * Ruta que sólo carga la ventana offscreen de rasterizado de PPTX.
 *
 * Vive en el renderer porque `@aiden0z/pptx-renderer` pinta a DOM. No pinta
 * nada para el usuario: el proceso principal captura sus frames. Ver
 * `electron/main/pptxRenderer/pptxRenderWindow.ts`.
 */

import { useEffect, useRef } from 'react'
import { buildPresentation, parseZip, renderSlide } from '@aiden0z/pptx-renderer'
import type { PresentationData } from '@aiden0z/pptx-renderer'
import { PPTX_MARKER_CSS_COLOR } from '../../../electron/main/pptxRenderer/pptxRenderTypes'

type SlideHandle = ReturnType<typeof renderSlide>

/**
 * Espera a que las imágenes decodifiquen y deja el vídeo en su primer
 * fotograma; sin esto se capturan diapositivas a medio pintar.
 *
 * Lo que no consigue cargar se oculta: una imagen rota pinta el icono de
 * Chromium (un dibujo de una palmera) y acabaría proyectado. Pasa de verdad —
 * los layouts de PowerPoint pueden traer vídeos incrustados.
 */
async function settleMedia(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          // Un recurso que no responde no debe colgar la importación entera.
          setTimeout(done, 5000)
        })
    )
  )
  for (const img of images) {
    if (img.naturalWidth === 0) img.style.visibility = 'hidden'
  }

  const videos = Array.from(root.querySelectorAll('video'))
  await Promise.all(
    videos.map((video) => {
      // Estamos rasterizando un fotograma fijo: los controles nativos no pintan.
      video.controls = false
      video.muted = true
      return new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve()
        const done = () => resolve()
        video.addEventListener('loadeddata', done, { once: true })
        video.addEventListener('error', done, { once: true })
        setTimeout(done, 5000)
      })
    })
  )
  for (const video of videos) {
    if (video.readyState < 2 && !video.poster) video.style.visibility = 'hidden'
  }
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

export default function PptxRenderHost() {
  const stageRef = useRef<HTMLDivElement>(null)
  const presRef = useRef<PresentationData | null>(null)
  const handleRef = useRef<SlideHandle | null>(null)

  useEffect(() => {
    // Ventana dedicada: se fuerza fondo blanco y sin márgenes para que el
    // frame capturado sea exactamente la diapositiva y el marcador ocupe todo.
    const { documentElement, body } = document
    documentElement.classList.remove('dark')
    // `index.html` pone `bg-background text-foreground font-sans` en el body.
    // Aquí estorban: `font-sans` sustituye la tipografía de la diapositiva y
    // cambia el ajuste de línea, y `bg-background` tiñe el fondo.
    body.className = ''
    documentElement.style.cssText = 'margin:0;padding:0;background:#fff;overflow:hidden'
    body.style.cssText = 'margin:0;padding:0;background:#fff;overflow:hidden;font-family:initial'
  }, [])

  useEffect(() => {
    const api = window.pptxRenderAPI
    if (!api) return

    const clearStage = () => {
      if (handleRef.current) {
        try {
          handleRef.current.dispose()
        } catch {
          // Un dispose fallido no debe impedir seguir con la diapositiva siguiente.
        }
        handleRef.current = null
      }
      if (stageRef.current) stageRef.current.innerHTML = ''
    }

    const offLoad = api.onLoad(async (bytes) => {
      try {
        const view = new Uint8Array(bytes)
        const files = await parseZip(
          view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
        )
        const pres = buildPresentation(files, {})
        presRef.current = pres
        api.sendLoaded({
          ok: true,
          width: pres.width,
          height: pres.height,
          slides: pres.slides.map((slide, index) => ({ index, hidden: !!slide.hidden }))
        })
      } catch (err) {
        api.sendLoaded({ ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    })

    const offMarker = api.onMarker(async () => {
      clearStage()
      const stage = stageRef.current
      if (!stage) return
      // Bloque con tamaño real: un absolute dentro de un `#stage` de altura 0
      // lo recorta el `overflow: hidden` del body y el marcador no llega a pintarse.
      const marker = document.createElement('div')
      marker.style.cssText = `width:100vw;height:100vh;background:${PPTX_MARKER_CSS_COLOR}`
      stage.appendChild(marker)
      await nextPaint()
      api.sendMarkered()
    })

    const offRender = api.onRenderSlide(async (index) => {
      const nodeErrors: string[] = []
      try {
        clearStage()
        const stage = stageRef.current
        const pres = presRef.current
        if (!stage || !pres) throw new Error('La ventana de rasterizado no tiene presentación cargada')

        const handle = renderSlide(pres, pres.slides[index], {
          onNodeError: (nodeId, error) => nodeErrors.push(`${nodeId}: ${error}`)
        })
        handleRef.current = handle
        stage.appendChild(handle.element)

        await handle.ready
        await settleMedia(stage)
        if (document.fonts?.ready) await document.fonts.ready
        await nextPaint()

        api.sendRendered({ index, nodeErrors })
      } catch (err) {
        api.sendRendered({
          index,
          nodeErrors,
          fatal: err instanceof Error ? err.message : String(err)
        })
      }
    })

    window.electron?.ipcRenderer?.send('pptx-render:ready')

    return () => {
      offLoad()
      offMarker()
      offRender()
      clearStage()
    }
  }, [])

  return <div ref={stageRef} style={{ position: 'relative', transformOrigin: 'top left' }} />
}
