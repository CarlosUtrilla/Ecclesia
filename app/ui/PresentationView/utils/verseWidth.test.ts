/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import {
  clampBibleVerseWidthPercent,
  DEFAULT_BIBLE_VERSE_WIDTH_PERCENT,
  resolveBibleVerseTranslateX,
  resolveBibleVerseWidthPercent
} from './verseWidth'

describe('verseWidth utils', () => {
  it('deberia limitar el ancho del indicador al rango permitido', () => {
    expect(clampBibleVerseWidthPercent(8)).toBe(20)
    expect(clampBibleVerseWidthPercent(64.6)).toBe(65)
    expect(clampBibleVerseWidthPercent(140)).toBe(100)
  })

  it('deberia resolver 100% cuando no existe ancho personalizado', () => {
    expect(resolveBibleVerseWidthPercent(undefined)).toBe(DEFAULT_BIBLE_VERSE_WIDTH_PERCENT)
    expect(resolveBibleVerseWidthPercent(null)).toBe(DEFAULT_BIBLE_VERSE_WIDTH_PERCENT)
    expect(resolveBibleVerseWidthPercent('')).toBe(DEFAULT_BIBLE_VERSE_WIDTH_PERCENT)
  })

  it('deberia aceptar strings y numeros validos', () => {
    expect(resolveBibleVerseWidthPercent(72)).toBe(72)
    expect(resolveBibleVerseWidthPercent('48')).toBe(48)
  })

  it('deberia resolver translateX del indicador con fallback a 0', () => {
    expect(resolveBibleVerseTranslateX(undefined)).toBe(0)
    expect(resolveBibleVerseTranslateX('18.4')).toBe(18)
    expect(resolveBibleVerseTranslateX(-12)).toBe(-12)
  })
})