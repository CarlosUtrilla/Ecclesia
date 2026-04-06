import type { SongLyricDTO } from 'database/controllers/songs/songs.dto'
import { clsx, type ClassValue } from 'clsx'
import DOMPurify from 'dompurify'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitiza HTML para evitar XSS y solo permite las etiquetas y atributos necesarios
 * para el formato de texto del editor (bold, italic, underline, font size).
 *
 * @param html string -> HTML sin sanitizar proveniente del editor
 * @returns string -> HTML limpio y seguro
 */
export function sanitizeHTML(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'span', 'br'],
    ALLOWED_ATTR: ['style']
  } as unknown as DOMPurify.Config)

  // Refuerzo defensivo: conservar solo propiedades de formato de texto y remover
  // cualquier propiedad peligrosa (expresiones, URLs, etc.).
  return sanitized.replace(/\sstyle="([^"]*)"/g, (_fullMatch, styleContent: string) => {
    const allowed = styleContent
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => {
        // Usar indexOf para manejar valores con : (ej: rgb(255,0,0))
        const colonIdx = part.indexOf(':')
        if (colonIdx === -1) return []
        const name = part.slice(0, colonIdx).trim().toLowerCase()
        const value = part.slice(colonIdx + 1).trim()

        if (name === 'font-size' && /^[\d.]+(?:em|px)$/.test(value)) return [`font-size: ${value}`]
        if (
          name === 'color' &&
          /^(?:#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\)|rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)|[a-z]+)$/.test(
            value
          )
        )
          return [`color: ${value}`]
        if (name === 'font-family' && /^["']?[\w\s,'".:-]+["']?$/.test(value))
          return [`font-family: ${value}`]
        if (name === 'font-weight' && /^(?:bold|normal|\d{3})$/.test(value))
          return [`font-weight: ${value}`]
        if (name === 'font-style' && /^(?:italic|normal|oblique)$/.test(value))
          return [`font-style: ${value}`]
        if (
          name === 'text-decoration' &&
          /^(?:underline|line-through|none|overline)$/.test(value)
        )
          return [`text-decoration: ${value}`]
        if (name === 'letter-spacing' && /^-?[\d.]+(?:em|px)$/.test(value))
          return [`letter-spacing: ${value}`]

        return []
      })

    if (allowed.length === 0) {
      return ''
    }

    return ` style="${allowed.join('; ')}"`
  })
}

export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  const isDark = document.documentElement.classList.contains('dark')
  if (hex.toLowerCase() === 'transparent') return isDark ? '#ffffff' : '#000000'
  // Limpieza básica del #
  const cleanHex = hex.replace('#', '')

  let rgbHex: string
  let alpha: number = 1 // Opacidad por defecto

  // Soporte para diferentes formatos hex
  if (cleanHex.length === 3) {
    // #rgb -> #rrggbb
    rgbHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('')
  } else if (cleanHex.length === 4) {
    // #rgba -> #rrggbb y extraer alpha
    rgbHex = cleanHex
      .substring(0, 3)
      .split('')
      .map((c) => c + c)
      .join('')
    alpha = parseInt(cleanHex[3] + cleanHex[3], 16) / 255
  } else if (cleanHex.length === 6) {
    // #rrggbb
    rgbHex = cleanHex
  } else if (cleanHex.length === 8) {
    // #rrggbbaa -> #rrggbb y extraer alpha
    rgbHex = cleanHex.substring(0, 6)
    alpha = parseInt(cleanHex.substring(6, 8), 16) / 255
  } else {
    // Formato no válido, usar negro por defecto
    return isDark ? '#000000' : '#ffffff'
  }

  let r = parseInt(rgbHex.substring(0, 2), 16)
  let g = parseInt(rgbHex.substring(2, 4), 16)
  let b = parseInt(rgbHex.substring(4, 6), 16)

  // Si hay opacidad, mezclar con fondo blanco (255, 255, 255)
  if (alpha < 1) {
    r = Math.round(r * alpha + 255 * (1 - alpha))
    g = Math.round(g * alpha + 255 * (1 - alpha))
    b = Math.round(b * alpha + 255 * (1 - alpha))
  }

  // Fórmula estándar de luminancia (WCAG)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b

  return luminance > 186 ? (isDark ? '#ffffff' : '#000000') : isDark ? '#000000' : '#ffffff'
}

export type GroupsTags = {
  tagSongsId: number | null
  contents: string[]
}
export const getGrupedLyrics = (lyrics: SongLyricDTO[]): GroupsTags[] => {
  let currentGroup: number | null = -1
  return lyrics.reduce((prev, curr) => {
    if (curr.tagSongsId !== currentGroup) {
      prev.push({
        tagSongsId: curr.tagSongsId || null,
        contents: [curr.content]
      })
      currentGroup = curr.tagSongsId || null
    } else {
      prev[prev.length - 1].contents.push(curr.content)
    }
    return prev
  }, [] as GroupsTags[])
}

export const generateUniqueId = (): string => {
  // Generar una cadena aleatoria de 16 caracteres inrepetible basando en la fecha de creación y un número aleatorio
  const timestamp = Date.now().toString(36) // Convertir la fecha actual a base36
  const randomNum = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .padStart(10, '0') // Número aleatorio en base36, rellenado a 10 caracteres
  return `${timestamp}-${randomNum}`
}

export const getMediaType = (format: string) => {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo'
  }
  const mime = mimeTypes[format] || 'application/octet-stream'
  return mime.startsWith('video/') ? 'video' : 'image'
}
