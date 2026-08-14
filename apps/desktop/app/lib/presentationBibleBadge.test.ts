import { describe, expect, it } from 'vitest'
import {
  buildPresentationBibleBadgeLabel,
  resolvePresentationBookShortName
} from './presentationBibleBadge'

describe('resolvePresentationBookShortName', () => {
  it('deberia priorizar book_short cuando existe', () => {
    const result = resolvePresentationBookShortName(40, [
      { id: 40, book_id: 40, book_short: 'Mat', book: 'Mateo' }
    ])

    expect(result).toBe('Mat')
  })

  it('deberia usar el nombre completo cuando no existe shortname', () => {
    const result = resolvePresentationBookShortName(40, [{ id: 999, book_id: 40, book: 'Mateo' }])

    expect(result).toBe('Mateo')
  })

  it('deberia usar el id numerico solo cuando el libro no esta en el esquema', () => {
    const result = resolvePresentationBookShortName(40, [
      { id: 1, book_id: 1, book_short: 'Gén', book: 'Génesis' }
    ])

    expect(result).toBe('40')
  })
})

describe('buildPresentationBibleBadgeLabel', () => {
  it('deberia formatear rango completo cuando no hay verso actual', () => {
    const label = buildPresentationBibleBadgeLabel({
      bookShortName: 'Mat',
      chapter: 3,
      rangeStart: 22,
      rangeEnd: 25
    })

    expect(label).toBe('Mat 3:22-25')
  })

  it('deberia formatear versiculo unico cuando inicio y fin son iguales', () => {
    const label = buildPresentationBibleBadgeLabel({
      bookShortName: 'Mat',
      chapter: 3,
      rangeStart: 22,
      rangeEnd: 22
    })

    expect(label).toBe('Mat 3:22')
  })

  it('deberia reflejar avance interno del verso actual', () => {
    const label = buildPresentationBibleBadgeLabel({
      bookShortName: 'Mat',
      chapter: 3,
      rangeStart: 22,
      rangeEnd: 25,
      currentVerse: 24
    })

    expect(label).toBe('Mat 3:24-25')
  })
})
