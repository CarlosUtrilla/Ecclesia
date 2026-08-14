/**
 * Normaliza texto igual que la columna `text_normalized` de los `.ebbl`:
 * minúsculas y sin diacríticos (`Jesús` → `jesus`, `niño` → `nino`).
 * Sin esto la búsqueda solo encuentra lo que se escribe exactamente sin tildes.
 */
export function normalizeBibleSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Escapa los comodines de LIKE (`%`, `_`) para que se busquen como caracteres
 * literales. El patrón resultante debe usarse con `ESCAPE '\'`.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&')
}

export function buildBibleSearchPattern(text: string): string {
  return `%${escapeLikePattern(normalizeBibleSearchText(text))}%`
}
