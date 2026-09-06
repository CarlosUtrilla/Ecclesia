import { describe, expect, it } from 'vitest'
import { headsMatch } from './oplog-heads'

describe('headsMatch', () => {
  it('reconoce que no hay nada pendiente cuando las heads coinciden', () => {
    expect(headsMatch(['a1', 'b2'], ['a1', 'b2'])).toBe(true)
  })

  it('ignora el orden: Automerge no garantiza uno estable', () => {
    expect(headsMatch(['a1', 'b2'], ['b2', 'a1'])).toBe(true)
  })

  it('detecta cambios locales cuando alguna head difiere', () => {
    expect(headsMatch(['a1', 'b2'], ['a1', 'c3'])).toBe(false)
  })

  it('detecta cambios cuando el número de heads no coincide', () => {
    expect(headsMatch(['a1', 'b2'], ['a1'])).toBe(false)
    expect(headsMatch(['a1'], ['a1', 'b2'])).toBe(false)
  })

  it('asume pendiente cuando no hay heads guardadas', () => {
    // Config previo a este campo, o dispositivo que nunca ha hecho push:
    // hay que subir para poder afirmar que local y remoto coinciden.
    expect(headsMatch(['a1'], null)).toBe(false)
    expect(headsMatch(['a1'], undefined)).toBe(false)
    expect(headsMatch(['a1'], [])).toBe(false)
  })

  it('asume pendiente con un doc sin heads', () => {
    expect(headsMatch([], [])).toBe(false)
    expect(headsMatch([], null)).toBe(false)
  })
})
