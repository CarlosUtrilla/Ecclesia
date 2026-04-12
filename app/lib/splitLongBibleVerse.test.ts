import { describe, expect, it } from 'vitest'
import {
  isBibleLiveSplitMode,
  resolveBibleChunkMaxLength,
  splitLongBibleVerse,
  splitBibleRangeIntoVerses,
  flattenVerseChunks
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

describe('splitBibleRangeIntoVerses', () => {
  it('debería dividir texto con múltiples versículos correctamente', () => {
    const text =
      '1 y se juntó todo el pueblo como un solo hombre en la plaza que está delante de la puerta de las Aguas, y dijeron a Esdras el escriba que trajese el libro de la ley de Moisés, la cual Jehová había dado a Israel. 2 Y el sacerdote Esdras trajo la ley delante de la congregación, así de hombres como de mujeres y de todos los que podían entender, el primer día del mes séptimo.'

    const result = splitBibleRangeIntoVerses(text, 16, 8, 1, 2, 180)

    expect(result).toHaveLength(2)
    expect(result[0].verse).toBe(1)
    expect(result[1].verse).toBe(2)
    expect(result[0].book).toBe(16)
    expect(result[0].chapter).toBe(8)

    // Verificar que no incluye números en el contenido
    expect(result[0].content[0]).not.toMatch(/^1\s/)
    expect(result[1].content[0]).not.toMatch(/^2\s/)
  })

  it('debería aplanar correctamente con metadata de verso', () => {
    const text = '1 texto corto del verso uno 2 texto corto del verso dos 3 texto corto del verso tres'

    const verses = splitBibleRangeIntoVerses(text, 16, 8, 1, 3, 180)
    const chunks = flattenVerseChunks(verses)

    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toMatchObject({ verse: 1, book: 16, chapter: 8 })
    expect(chunks[1]).toMatchObject({ verse: 2, book: 16, chapter: 8 })
    expect(chunks[2]).toMatchObject({ verse: 3, book: 16, chapter: 8 })
    expect(chunks[0].content).toContain('texto corto del verso uno')
    expect(chunks[1].content).toContain('texto corto del verso dos')
    expect(chunks[2].content).toContain('texto corto del verso tres')
  })

  it('debería dividir verso largo en múltiples chunks con metadata correcta', () => {
    const longVerse1 = 'palabra '.repeat(50) // Texto muy largo
    const text = `1 ${longVerse1} 2 texto corto del verso dos`

    const verses = splitBibleRangeIntoVerses(text, 16, 8, 1, 2, 100)
    const chunks = flattenVerseChunks(verses)

    // El verso 1 largo debe generar múltiples chunks
    expect(chunks.length).toBeGreaterThan(2)

    // Los primeros chunks deben tener verse: 1
    const verse1Chunks = chunks.filter((c) => c.verse === 1)
    expect(verse1Chunks.length).toBeGreaterThan(1)

    // Todos los chunks deben tener book y chapter correctos
    chunks.forEach((chunk) => {
      expect(chunk.book).toBe(16)
      expect(chunk.chapter).toBe(8)
    })

    // El último chunk debe ser del verso 2
    expect(chunks[chunks.length - 1].verse).toBe(2)

    // Verificar ellipsis dentro del verso 1
    if (verse1Chunks.length > 1) {
      expect(verse1Chunks[0].content).toMatch(/\.\.\.$/)
      expect(verse1Chunks[1].content).toMatch(/^\.\.\./)
    }

    // Verificar que NO hay ellipsis entre versos diferentes
    const lastVerse1 = verse1Chunks[verse1Chunks.length - 1]
    const firstVerse2 = chunks.find((c) => c.verse === 2)!
    expect(lastVerse1.content).not.toMatch(/\.\.\.$/)
    expect(firstVerse2.content).not.toMatch(/^\.\.\./)
  })
})
