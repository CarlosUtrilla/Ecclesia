import { describe, expect, it } from 'vitest'
import { serializeOutboxPayload } from './outboxPayload'

describe('serializeOutboxPayload', () => {
  it('deberia serializar bigint seguro como numero', () => {
    const payload = { screenId: BigInt(123456) }
    expect(serializeOutboxPayload(payload)).toBe('{"screenId":123456}')
  })

  it('deberia serializar bigint fuera de rango seguro como string', () => {
    const huge = BigInt('9223372036854775807')
    const payload = { screenId: huge }
    expect(serializeOutboxPayload(payload)).toBe('{"screenId":"9223372036854775807"}')
  })
})
