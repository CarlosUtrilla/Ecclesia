/**
 * Wrapper sobre el addon nativo `@stagetimerio/grandiose` (NDI SDK).
 *
 * El módulo se carga de forma perezosa: si el binario nativo no está disponible
 * (CPU sin soporte, build sin `asarUnpack`, plataforma no soportada) la app debe
 * seguir funcionando con la salida NDI simplemente desactivada.
 */

import log from 'electron-log'
import type { NdiOutputConfig } from './ndiConfig'

type GrandioseModule = typeof import('@stagetimerio/grandiose')
type VideoSendFrame = Parameters<
  Awaited<ReturnType<GrandioseModule['send']>>['video']
>[0]

/**
 * Constantes del runtime NDI. El `.d.ts` del paquete las declara como `const enum`,
 * que no sobrevive a la compilación de esbuild/electron-vite, así que se usan los
 * valores numéricos (y se prefieren los exports reales del módulo si existen).
 */
const FOURCC_BGRA = 1095911234
const FORMAT_TYPE_PROGRESSIVE = 1

/** Funciones que expone el runtime pero que faltan en el `.d.ts` del paquete. */
type GrandioseRuntimeExtras = {
  isSupportedCPU?: () => boolean
  version?: () => string
}

function runtimeConstant(grandiose: GrandioseModule, name: string, fallback: number): number {
  const value = (grandiose as unknown as Record<string, unknown>)[name]
  return typeof value === 'number' ? value : fallback
}

let cachedModule: GrandioseModule | null = null
let loadErrorMessage: string | null = null

/** Carga (una sola vez) el addon nativo. Devuelve `null` si no está disponible. */
export function loadGrandiose(): GrandioseModule | null {
  if (cachedModule) return cachedModule
  if (loadErrorMessage) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const grandiose = require('@stagetimerio/grandiose') as GrandioseModule

    const { isSupportedCPU } = grandiose as unknown as GrandioseRuntimeExtras

    if (typeof isSupportedCPU === 'function' && !isSupportedCPU()) {
      loadErrorMessage = 'La CPU no soporta NDI'
      log.warn('[ndi] CPU no soportada por el runtime NDI')
      return null
    }

    cachedModule = grandiose
    return cachedModule
  } catch (error) {
    loadErrorMessage = error instanceof Error ? error.message : String(error)
    log.error('[ndi] No se pudo cargar el addon nativo NDI:', error)
    return null
  }
}

export function getNdiLoadError(): string | null {
  return loadErrorMessage
}

export function isNdiAvailable(): boolean {
  return loadGrandiose() !== null
}

/** Versión del runtime NDI (`null` si el addon no está disponible). */
export function getNdiVersion(): string | null {
  const grandiose = loadGrandiose()
  if (!grandiose) return null

  try {
    const { version } = grandiose as unknown as GrandioseRuntimeExtras
    return typeof version === 'function' ? version() : null
  } catch {
    return null
  }
}

export type NdiVideoFrame = {
  data: Buffer
  width: number
  height: number
}

export type NdiSenderHandle = {
  /** Nombre completo de la fuente, con hostname: `MI-PC (Ecclesia)`. */
  sourceName: string
  /**
   * Envía un frame BGRA. Descarta el frame si el envío anterior sigue en curso,
   * para no acumular buffers cuando la red o el receptor van más lentos.
   */
  sendVideo: (frame: NdiVideoFrame) => void
  /** Receptores conectados actualmente. */
  connections: () => number
  destroy: () => Promise<void>
}

/**
 * Crea un sender NDI. Devuelve `null` si el addon nativo no está disponible.
 * `clockVideo` se deja en `false`: el ritmo lo marca el ticker del manager,
 * así un frame estático se puede reenviar sin bloquear el hilo principal.
 */
export async function createNdiSender(config: NdiOutputConfig): Promise<NdiSenderHandle | null> {
  const grandiose = loadGrandiose()
  if (!grandiose) return null

  const sender = await grandiose.send({
    name: config.sourceName,
    clockVideo: false,
    clockAudio: false
  })

  const frameRateN = Math.round(config.fps * 1000)
  const frameRateD = 1000
  const fourCC = runtimeConstant(grandiose, 'FOURCC_BGRA', FOURCC_BGRA)
  const frameFormatType = runtimeConstant(
    grandiose,
    'FORMAT_TYPE_PROGRESSIVE',
    FORMAT_TYPE_PROGRESSIVE
  )
  let sending = false
  let destroyed = false
  let droppedFrames = 0

  return {
    sourceName: sender.sourcename(),

    sendVideo(frame: NdiVideoFrame) {
      if (destroyed || sending) {
        if (!destroyed) droppedFrames += 1
        return
      }

      sending = true
      sender
        .video({
          xres: frame.width,
          yres: frame.height,
          frameRateN,
          frameRateD,
          fourCC,
          pictureAspectRatio: frame.width / frame.height,
          frameFormatType,
          lineStrideBytes: frame.width * 4,
          data: frame.data
        } as VideoSendFrame)
        .catch((error) => {
          if (!destroyed) log.error('[ndi] Error enviando frame:', error)
        })
        .finally(() => {
          sending = false
        })
    },

    connections() {
      try {
        return sender.connections()
      } catch {
        return 0
      }
    },

    async destroy() {
      if (destroyed) return
      destroyed = true

      if (droppedFrames > 0) {
        log.info(`[ndi] Frames descartados por congestión: ${droppedFrames}`)
      }

      try {
        await sender.destroy()
      } catch (error) {
        log.error('[ndi] Error destruyendo el sender:', error)
      }
    }
  }
}
