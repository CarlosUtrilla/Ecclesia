import { describe, expect, it } from 'vitest'
import { getOpenCodeSessionId, resetOpenCodeSessionId } from './ai.session'

describe('getOpenCodeSessionId', () => {
  it('debería generar un UUID válido en el primer uso', () => {
    resetOpenCodeSessionId()
    expect(getOpenCodeSessionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('debería devolver el mismo ID en llamadas sucesivas de la misma sesión', () => {
    resetOpenCodeSessionId()
    expect(getOpenCodeSessionId()).toBe(getOpenCodeSessionId())
  })
})