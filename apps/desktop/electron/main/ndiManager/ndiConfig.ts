/**
 * Configuración de la salida de vídeo NDI.
 *
 * Se persiste como JSON en `Setting` bajo la clave pública `NDI_OUTPUT_CONFIG`
 * (mismo patrón que `OBS_TEXT_OVERLAY_CONFIG`).
 */

export type NdiOutputConfig = {
  /** Si la salida NDI debe arrancar automáticamente al abrir la app. */
  enabled: boolean
  /** Nombre de la fuente NDI (NDI antepone el hostname automáticamente). */
  sourceName: string
  /** Ancho del frame emitido, en píxeles. */
  width: number
  /** Alto del frame emitido, en píxeles. */
  height: number
  /** Frames por segundo emitidos. */
  fps: number
}

export const DEFAULT_NDI_CONFIG: NdiOutputConfig = {
  enabled: false,
  sourceName: 'Ecclesia',
  width: 1280,
  height: 720,
  fps: 30
}

export const NDI_MIN_WIDTH = 320
export const NDI_MAX_WIDTH = 3840
export const NDI_MIN_HEIGHT = 180
export const NDI_MAX_HEIGHT = 2160
export const NDI_MIN_FPS = 1
export const NDI_MAX_FPS = 60
export const NDI_MAX_SOURCE_NAME_LENGTH = 64

function clampEven(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback

  const clamped = Math.min(Math.max(Math.round(parsed), min), max)
  // NDI trabaja mejor con dimensiones pares; redondeamos hacia abajo sin salir del rango.
  const even = clamped % 2 === 0 ? clamped : clamped - 1
  return even < min ? min : even
}

function clampFps(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.round(parsed), NDI_MIN_FPS), NDI_MAX_FPS)
}

/**
 * Sanea el nombre de la fuente NDI: sin caracteres de control, recortado y con
 * longitud máxima. Si queda vacío, usa el valor por defecto.
 */
export function sanitizeNdiSourceName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_NDI_CONFIG.sourceName

  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, NDI_MAX_SOURCE_NAME_LENGTH)
    .trim()

  return cleaned.length > 0 ? cleaned : DEFAULT_NDI_CONFIG.sourceName
}

/**
 * Convierte cualquier entrada (JSON string, objeto parcial, null) en una config válida.
 * Nunca lanza: ante datos corruptos devuelve los valores por defecto.
 */
export function parseNdiConfig(raw: unknown): NdiOutputConfig {
  let source: unknown = raw

  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw)
    } catch {
      return { ...DEFAULT_NDI_CONFIG }
    }
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ...DEFAULT_NDI_CONFIG }
  }

  const candidate = source as Partial<NdiOutputConfig>

  return {
    enabled: candidate.enabled === true,
    sourceName: sanitizeNdiSourceName(candidate.sourceName),
    width: clampEven(candidate.width, NDI_MIN_WIDTH, NDI_MAX_WIDTH, DEFAULT_NDI_CONFIG.width),
    height: clampEven(candidate.height, NDI_MIN_HEIGHT, NDI_MAX_HEIGHT, DEFAULT_NDI_CONFIG.height),
    fps: clampFps(candidate.fps, DEFAULT_NDI_CONFIG.fps)
  }
}

export function serializeNdiConfig(config: NdiOutputConfig): string {
  return JSON.stringify(parseNdiConfig(config))
}

/** Indica si un cambio de config obliga a recrear el sender / la ventana de captura. */
export function requiresNdiRestart(previous: NdiOutputConfig, next: NdiOutputConfig): boolean {
  return (
    previous.sourceName !== next.sourceName ||
    previous.width !== next.width ||
    previous.height !== next.height ||
    previous.fps !== next.fps
  )
}
