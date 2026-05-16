import { sanitizeHTML } from '@/lib/utils'

export function splitHtmlForWordAnimation(text: string): string[][] {
  return text.split(/<br\s*\/?>/i).map((line) => {
    const trimmed = line.trim()

    // Si la línea contiene etiquetas HTML, tratarla como una sola unidad
    // para no romper atributos (por ejemplo style="...") al dividir por espacios.
    if (/<[^>]+>/.test(trimmed)) {
      return trimmed ? [sanitizeHTML(trimmed)] : []
    }

    return trimmed
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => sanitizeHTML(word))
  })
}