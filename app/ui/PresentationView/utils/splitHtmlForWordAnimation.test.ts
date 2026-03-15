/* eslint-env vitest */
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { splitHtmlForWordAnimation } from './splitHtmlForWordAnimation'

describe('splitHtmlForWordAnimation', () => {
  it('divide texto plano en palabras', () => {
    const result = splitHtmlForWordAnimation('Hola mundo Ecclesia')
    expect(result).toEqual([['Hola', 'mundo', 'Ecclesia']])
  })

  it('mantiene una linea HTML como unidad para no romper atributos style', () => {
    const html = '<span style="font-size: 1.2em">Juan 3:16</span>'
    const result = splitHtmlForWordAnimation(html)

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
    expect(result[0][0]).toContain('style="font-size: 1.2em"')
    expect(result[0][0]).toContain('Juan 3:16')
  })

  it('respeta saltos de linea con <br>', () => {
    const result = splitHtmlForWordAnimation('Primera linea<br/>Segunda linea')
    expect(result).toEqual([['Primera', 'linea'], ['Segunda', 'linea']])
  })
})
