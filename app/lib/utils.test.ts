/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { generateUniqueId, getContrastTextColor } from './utils'

describe('getContrastTextColor', () => {
  it('retorna blanco para fondos oscuros y negro para fondos claros', () => {
    expect(getContrastTextColor('#000000')).toBe('#ffffff')
    expect(getContrastTextColor('#ffffff')).toBe('#000000')
  })

  it('maneja transparencias con mezcla sobre blanco', () => {
    expect(getContrastTextColor('#00000080')).toBe('#ffffff')
    expect(getContrastTextColor('transparent')).toBe('#000000')
  })
})

describe('generateUniqueId', () => {
  it('genera IDs no vacíos con formato esperado', () => {
    const id = generateUniqueId()
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('evita colisiones en generación secuencial corta', () => {
    const values = new Set(Array.from({ length: 200 }, () => generateUniqueId()))
    expect(values.size).toBe(200)
  })
})
