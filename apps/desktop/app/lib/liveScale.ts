import { BASE_PRESENTATION_HEIGHT } from './themeConstants'

/**
 * Escala un valor en px —definido a la altura de referencia
 * `BASE_PRESENTATION_HEIGHT` (el tamaño del preview)— al tamaño real del
 * contenedor donde se renderiza en vivo/stage.
 *
 * REGLA (live/stage): todo lo que se muestra en pantallas en vivo (LiveScreen,
 * StageScreen, overlays, PresentationView) debe dimensionarse con tamaños
 * proporcionales calculados a partir del tamaño del contenedor, NUNCA con px/rem
 * fijos. Así un elemento se ve idéntico en el preview pequeño y en una pantalla
 * 1920×1080. Usa este helper (o el ratio `containerHeightPx /
 * BASE_PRESENTATION_HEIGHT`) para derivar cualquier px absoluto (blur, spread,
 * padding, gap, tamaño de fuente base, etc.).
 *
 * @param basePx Valor en px medido a la altura de referencia.
 * @param containerHeightPx Altura real del contenedor en vivo.
 * @param referenceHeightPx Altura de referencia (por defecto `BASE_PRESENTATION_HEIGHT`).
 */
export function scaleLivePx(
  basePx: number,
  containerHeightPx: number,
  referenceHeightPx: number = BASE_PRESENTATION_HEIGHT
): number {
  if (!Number.isFinite(containerHeightPx) || containerHeightPx <= 0) return basePx
  if (!Number.isFinite(referenceHeightPx) || referenceHeightPx <= 0) return basePx
  return (basePx * containerHeightPx) / referenceHeightPx
}
