/**
 * Escala de rasterizado de las diapositivas.
 *
 * Módulo aparte y sin dependencias de Electron para poder probarlo, igual que
 * `ndiManager/ndiConfig.ts`.
 */

/** Una diapositiva 16:9 de 1280x720 sale a 2560x1440, suficiente para 1080p. */
export const PPTX_MIN_SCALE = 2
/** Tope para no disparar memoria ni disco en mazos largos. */
export const PPTX_MAX_SCALE = 4

/**
 * Deriva la escala de la pantalla más ancha conectada, para que un proyector
 * 4K no reciba diapositivas de 1080p reescaladas.
 */
export function resolveRenderScale(slideWidth: number, displayWidths: number[]): number {
  if (!Number.isFinite(slideWidth) || slideWidth <= 0) return PPTX_MIN_SCALE

  const finiteWidths = displayWidths.filter((w) => Number.isFinite(w) && w > 0)
  if (finiteWidths.length === 0) return PPTX_MIN_SCALE

  const needed = Math.ceil(Math.max(...finiteWidths) / slideWidth)
  return Math.min(PPTX_MAX_SCALE, Math.max(PPTX_MIN_SCALE, needed))
}
