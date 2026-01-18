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
  // Limpieza básica del #
  const cleanHex = hex.replace('#', '')

  // Soporte para hex corto (#fff)
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex

  const r = parseInt(fullHex.substring(0, 2), 16)
  const g = parseInt(fullHex.substring(2, 4), 16)
  const b = parseInt(fullHex.substring(4, 6), 16)

  // Fórmula estándar de luminancia (WCAG)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b

  return luminance > 186 ? '#000000' : '#ffffff'
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
