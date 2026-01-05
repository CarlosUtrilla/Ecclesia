import { clsx, type ClassValue } from 'clsx'
import DOMPurify from 'dompurify'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Devuelve la URL correcta para un <img> según el tipo de input.
 *
 * @param image string -> puede ser un base64 completo o un nombre de archivo guardado
 */
export function loadImage(image: string | null) {
  if (image === null || image === undefined) return ''
  // Si empieza con data:image/... asumimos que es base64
  if (image.startsWith('data:image/')) {
    return image // se puede usar tal cual en src
  }

  // Si es un nombre de archivo guardado, usamos el protocolo myapp://
  return `myapp:///${image}`
}

/**
 * Sanitiza HTML para evitar XSS y solo permite las etiquetas y atributos necesarios
 * para el formato de texto del editor (bold, italic, underline, font size).
 *
 * @param html string -> HTML sin sanitizar proveniente del editor
 * @returns string -> HTML limpio y seguro
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'span', 'br'],
    ALLOWED_ATTR: ['style'],
    ALLOWED_STYLES: {
      '*': {
        'font-size': [/^[\d.]+em$/]
      }
    }
  })
}
