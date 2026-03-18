import { describe, expect, it } from 'vitest'
import { resolveBibleBookAccessId } from './accessData'

describe('bible accessData', () => {
  it('deberia priorizar book_id para el accessData de biblia', () => {
    const result = resolveBibleBookAccessId({ id: 11, book_id: 43 })

    expect(result).toBe(43)
  })

  it('deberia usar id como fallback si no existe book_id', () => {
    const result = resolveBibleBookAccessId({ id: 11 })

    expect(result).toBe(11)
  })

  it('deberia retornar null si no existe ningun id valido', () => {
    expect(resolveBibleBookAccessId(undefined)).toBeNull()
    expect(resolveBibleBookAccessId({ id: 'abc', book_id: null })).toBeNull()
  })
})
