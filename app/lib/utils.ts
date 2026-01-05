import { clsx, type ClassValue } from 'clsx'

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
