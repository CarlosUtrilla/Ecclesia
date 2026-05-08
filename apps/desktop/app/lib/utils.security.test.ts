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

  it('mantiene etiquetas permitidas y propiedades de formato inline de texto', () => {
    const input =
      '<p><strong>Texto</strong> <span style="font-size: 1.2em; color: red; font-weight: bold;">Visible</span></p>'

    const output = sanitizeHTML(input)

    expect(output).toContain('<strong>Texto</strong>')
    expect(output).toContain('font-size: 1.2em')
    expect(output).toContain('color: red')
    expect(output).toContain('font-weight: bold')
  })

  it('bloquea propiedades CSS peligrosas (expresiones, URLs JavaScript)', () => {
    const xss1 = '<span style="background: url(javascript:alert(1))">test</span>'
    const xss2 = '<span style="color: expression(alert(1))">test</span>'
    const xss3 = '<span style="margin: 10px; position: absolute; top: 0">test</span>'

    expect(sanitizeHTML(xss1)).not.toContain('url(')
    expect(sanitizeHTML(xss2)).not.toContain('expression(')
    expect(sanitizeHTML(xss3)).not.toContain('position')
    expect(sanitizeHTML(xss3)).not.toContain('margin')
  })
})
