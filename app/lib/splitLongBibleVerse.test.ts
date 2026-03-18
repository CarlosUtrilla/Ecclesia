import { describe, expect, it } from 'vitest'
import {
  isBibleLiveSplitMode,
  resolveBibleChunkMaxLength,
  splitLongBibleVerse
} from './splitLongBibleVerse'

describe('splitLongBibleVerse', () => {
  it('deberia dejar intacto un versiculo corto', () => {
    expect(splitLongBibleVerse('Porque de tal manera amo Dios al mundo.', 80)).toEqual([
      'Porque de tal manera amo Dios al mundo.'
    ])
  })

  it('deberia dividir un versiculo largo priorizando cortes por oracion', () => {
    const text =
      'Este es un versiculo muy largo que contiene una primera idea completa. Despues sigue una segunda idea tambien bastante extensa para que el algoritmo necesite dividir el contenido sin romper la lectura en pantalla.'

    expect(splitLongBibleVerse(text, 90)).toEqual([
      'Este es un versiculo muy largo que contiene una primera idea completa. ...',
      '... Despues sigue una segunda idea tambien bastante extensa para que el algoritmo necesite ...',
      '... dividir el contenido sin romper la lectura en pantalla.'
    ])
  })

  it('deberia soportar cortes forzados por palabras cuando no hay puntuacion suficiente', () => {
    const text =
      'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince'

    expect(splitLongBibleVerse(text, 24)).toEqual([
      'uno dos tres cuatro ...',
      '... cinco seis siete ocho ...',
      '... nueve diez once doce ...',
      '... trece catorce quince'
    ])
  })

  it('deberia preferir una coma cercana al limite sin cortar palabras', () => {
    const text =
      'en la hermosura de su majestad, es donde quiero estar y contemplar la gloria de Dios por siempre'

    expect(splitLongBibleVerse(text, 28)).toEqual([
      'en la hermosura de su majestad, ...',
      '... es donde quiero estar y ...',
      '... contemplar la gloria de Dios ...',
      '... por siempre'
    ])

    expect(splitLongBibleVerse('hermosura admirable y eterna', 10)).toEqual([
      'hermosura ...',
      '... admirable ...',
      '... y eterna'
    ])
  })

  it('deberia resolver maxLength fijo y automatico segun fontSize', () => {
    expect(resolveBibleChunkMaxLength('200')).toBe(200)
    expect(resolveBibleChunkMaxLength('auto', 72)).toBe(180)
    expect(resolveBibleChunkMaxLength('auto', '96px')).toBe(135)
    expect(resolveBibleChunkMaxLength('auto', 40)).toBe(250)
    expect(resolveBibleChunkMaxLength('auto', 200)).toBe(100)
  })

  it('deberia validar modos soportados', () => {
    expect(isBibleLiveSplitMode('auto')).toBe(true)
    expect(isBibleLiveSplitMode('150')).toBe(true)
    expect(isBibleLiveSplitMode('75')).toBe(false)
  })
})
