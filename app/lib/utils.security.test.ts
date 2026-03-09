/* eslint-env vitest */
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { sanitizeHTML } from './utils'

describe('sanitizeHTML', () => {
  it('elimina scripts y handlers inline para prevenir XSS', () => {
    const input =
      '<p onclick="alert(1)">Hola</p><script>alert("xss")</script><img src=x onerror="alert(2)" />'

    const output = sanitizeHTML(input)

    expect(output).toContain('<p>Hola</p>')
    expect(output).not.toContain('<script')
    expect(output).not.toContain('onclick=')
    expect(output).not.toContain('onerror=')
    expect(output).not.toContain('<img')
  })

  it('mantiene etiquetas permitidas y font-size en em', () => {
    const input =
      '<p><strong>Texto</strong> <span style="font-size: 1.2em; color: red;">Visible</span></p>'

    const output = sanitizeHTML(input)

    expect(output).toContain('<strong>Texto</strong>')
    expect(output).toContain('font-size: 1.2em')
    expect(output).not.toContain('color: red')
  })
})
