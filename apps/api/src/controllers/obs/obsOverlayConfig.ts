// Configuración del overlay de texto para OBS (subtítulos).
// Se persiste como un único blob JSON en la tabla Setting bajo la clave
// pública OBS_TEXT_OVERLAY_CONFIG y viaja al browser source vía GET /obs/config
// y el evento socket obsConfigUpdate.

export type ObsOverlayPosition = 'top' | 'center' | 'bottom'
export type ObsOverlayTextAlign = 'left' | 'center' | 'right'
export type ObsOverlayHorizontalAlign = 'left' | 'center' | 'right'
export type ObsOverlayReferencePosition = 'above' | 'below'

export type ObsOverlayConfig = {
  enabled: boolean
  textColor: string
  transparentBackground: boolean // si true, el recuadro no tiene fondo (solo texto)
  backgroundColor: string
  backgroundOpacity: number // 0..1 del color de fondo del recuadro
  fontFamily: string
  fontSize: number // px (referido a una altura de 1080)
  fontWeight: number
  position: ObsOverlayPosition // posición vertical del recuadro
  horizontalAlign: ObsOverlayHorizontalAlign // posición horizontal del recuadro
  textAlign: ObsOverlayTextAlign
  paddingX: number // px
  paddingY: number // px
  maxWidth: number // porcentaje del ancho 0..100
  textShadow: boolean
  uppercase: boolean
  // Borde/contorno del texto (para contraste sin fondo)
  textBorder: boolean
  textBorderColor: string
  textBorderWidth: number // px
  // Indicador de referencia bíblica (ej. "Juan 3:16"), estilizable aparte
  showReference: boolean
  referencePosition: ObsOverlayReferencePosition // indicador arriba o abajo del texto
  referenceColor: string
  referenceFontScale: number // tamaño de la referencia relativo al del texto (0.2..1)
  backgroundMediaId: number | null // imagen de fondo personalizada (id de Media)
  customCss: string // CSS libre inyectado en la página; puede targetear #stage, #box, #text, #reference
}

export const DEFAULT_OBS_CONFIG: ObsOverlayConfig = {
  enabled: false,
  textColor: '#ffffff',
  transparentBackground: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.55,
  fontFamily: 'Arial, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  position: 'bottom',
  horizontalAlign: 'center',
  textAlign: 'center',
  paddingX: 32,
  paddingY: 20,
  maxWidth: 90,
  textShadow: true,
  uppercase: false,
  textBorder: false,
  textBorderColor: '#000000',
  textBorderWidth: 2,
  showReference: true,
  referencePosition: 'below',
  referenceColor: '#ffd54a',
  referenceFontScale: 0.9,
  backgroundMediaId: null,
  customCss: ''
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

/**
 * Combina de forma segura un objeto crudo (posiblemente parcial o inválido)
 * sobre los valores por defecto, saneando cada campo. Nunca lanza.
 */
export function parseObsConfig(raw: string | null | undefined | Record<string, unknown>): ObsOverlayConfig {
  let source: Record<string, unknown> = {}

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') source = parsed as Record<string, unknown>
    } catch {
      source = {}
    }
  } else if (raw && typeof raw === 'object') {
    source = raw
  }

  const position = source.position
  const horizontalAlign = source.horizontalAlign
  const textAlign = source.textAlign
  const referencePosition = source.referencePosition
  const mediaId = source.backgroundMediaId

  return {
    enabled: asBoolean(source.enabled, DEFAULT_OBS_CONFIG.enabled),
    textColor: asString(source.textColor, DEFAULT_OBS_CONFIG.textColor),
    transparentBackground: asBoolean(source.transparentBackground, DEFAULT_OBS_CONFIG.transparentBackground),
    backgroundColor: asString(source.backgroundColor, DEFAULT_OBS_CONFIG.backgroundColor),
    backgroundOpacity: clampNumber(source.backgroundOpacity, 0, 1, DEFAULT_OBS_CONFIG.backgroundOpacity),
    fontFamily: asString(source.fontFamily, DEFAULT_OBS_CONFIG.fontFamily),
    fontSize: clampNumber(source.fontSize, 8, 400, DEFAULT_OBS_CONFIG.fontSize),
    fontWeight: clampNumber(source.fontWeight, 100, 900, DEFAULT_OBS_CONFIG.fontWeight),
    position:
      position === 'top' || position === 'center' || position === 'bottom'
        ? position
        : DEFAULT_OBS_CONFIG.position,
    horizontalAlign:
      horizontalAlign === 'left' || horizontalAlign === 'center' || horizontalAlign === 'right'
        ? horizontalAlign
        : DEFAULT_OBS_CONFIG.horizontalAlign,
    textAlign:
      textAlign === 'left' || textAlign === 'center' || textAlign === 'right'
        ? textAlign
        : DEFAULT_OBS_CONFIG.textAlign,
    paddingX: clampNumber(source.paddingX, 0, 400, DEFAULT_OBS_CONFIG.paddingX),
    paddingY: clampNumber(source.paddingY, 0, 400, DEFAULT_OBS_CONFIG.paddingY),
    maxWidth: clampNumber(source.maxWidth, 10, 100, DEFAULT_OBS_CONFIG.maxWidth),
    textShadow: asBoolean(source.textShadow, DEFAULT_OBS_CONFIG.textShadow),
    uppercase: asBoolean(source.uppercase, DEFAULT_OBS_CONFIG.uppercase),
    textBorder: asBoolean(source.textBorder, DEFAULT_OBS_CONFIG.textBorder),
    textBorderColor: asString(source.textBorderColor, DEFAULT_OBS_CONFIG.textBorderColor),
    textBorderWidth: clampNumber(source.textBorderWidth, 0, 20, DEFAULT_OBS_CONFIG.textBorderWidth),
    showReference: asBoolean(source.showReference, DEFAULT_OBS_CONFIG.showReference),
    referencePosition:
      referencePosition === 'above' || referencePosition === 'below'
        ? referencePosition
        : DEFAULT_OBS_CONFIG.referencePosition,
    referenceColor: asString(source.referenceColor, DEFAULT_OBS_CONFIG.referenceColor),
    referenceFontScale: clampNumber(source.referenceFontScale, 0.2, 1, DEFAULT_OBS_CONFIG.referenceFontScale),
    backgroundMediaId:
      typeof mediaId === 'number' && Number.isFinite(mediaId)
        ? mediaId
        : typeof mediaId === 'string' && mediaId.trim() !== '' && Number.isFinite(Number(mediaId))
          ? Number(mediaId)
          : null,
    customCss: typeof source.customCss === 'string' ? source.customCss : DEFAULT_OBS_CONFIG.customCss
  }
}
