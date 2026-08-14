/**
 * Las presentaciones creadas al importar un PDF/PPTX no son presentaciones de biblioteca:
 * pertenecen al Media importado y solo existen para renderizar sus páginas en vivo.
 * Se marcan con este prefijo en el título, que es el único rastro que sobrevive si el
 * Media padre se purga (hard delete del oplog tras el retention), dejando la presentación
 * huérfana. Por eso `getPresentations` filtra por prefijo además de por la relación.
 */
export const PDF_PRESENTATION_TITLE_PREFIX = '__pdf_'
export const PPTX_PRESENTATION_TITLE_PREFIX = '__pptx_'

export const IMPORTED_PRESENTATION_TITLE_PREFIXES = [
  PDF_PRESENTATION_TITLE_PREFIX,
  PPTX_PRESENTATION_TITLE_PREFIX
]
