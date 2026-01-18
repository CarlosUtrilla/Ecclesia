import { Lyrics } from '@prisma/client'
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

export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  if (hex.toLowerCase() === 'transparent') return '#000000'
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
    return '#ffffff'
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

  // Fórmula WCAG para luminancia relativa
  const toLinear = (c: number) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }

  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

  // Umbral WCAG: 0.179 para AA normal (equivale a ~128 en escala 0-255)
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

export type GroupsTags = {
  tagSongsId: number | null
  contents: string[]
}
export const getGrupedLyrics = (lyrics: Lyrics[]): GroupsTags[] => {
  let currentGroup: number | null = null
  return lyrics.reduce((prev, curr) => {
    if (curr.tagSongsId !== currentGroup || curr.tagSongsId === null) {
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
