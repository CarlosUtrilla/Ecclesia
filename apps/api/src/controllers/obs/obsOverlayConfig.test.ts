import { describe, it, expect } from 'vitest'
import { DEFAULT_OBS_CONFIG, parseObsConfig, parseObsSubtitles, sanitizeSlug } from './obsOverlayConfig'

describe('sanitizeSlug', () => {
  it('debería normalizar a slug de ruta seguro', () => {
    expect(sanitizeSlug('My Custom Path')).toBe('my-custom-path')
    expect(sanitizeSlug('/text-1/')).toBe('text-1')
    expect(sanitizeSlug('Biblia & Cánticos!')).toBe('biblia-c-nticos')
    expect(sanitizeSlug(123)).toBe('')
  })
})

describe('parseObsSubtitles', () => {
  it('debería devolver [] con entrada vacía/inválida/no-array', () => {
    expect(parseObsSubtitles(null)).toEqual([])
    expect(parseObsSubtitles('no json')).toEqual([])
    expect(parseObsSubtitles(JSON.stringify({}))).toEqual([])
  })

  it('debería parsear una lista con slug, name, types y estilo saneado', () => {
    const list = parseObsSubtitles(
      JSON.stringify([
        { slug: 'Biblia', name: 'Versículos', types: ['BIBLE', 'x'], textColor: '#ff0000' },
        { slug: 'text-2' }
      ])
    )
    expect(list).toHaveLength(2)
    expect(list[0].slug).toBe('biblia')
    expect(list[0].name).toBe('Versículos')
    expect(list[0].types).toEqual(['BIBLE'])
    expect(list[0].textColor).toBe('#ff0000')
    expect(list[0].fontSize).toBe(DEFAULT_OBS_CONFIG.fontSize)
    expect(list[1].slug).toBe('text-2')
    expect(list[1].name).toBe('text-2')
    expect(list[1].types).toEqual([])
  })

  it('debería descartar items sin slug y deduplicar slugs', () => {
    const list = parseObsSubtitles(
      JSON.stringify([{ slug: 'a' }, { slug: 'a', name: 'dup' }, { name: 'sin slug' }])
    )
    expect(list.map((s) => s.slug)).toEqual(['a'])
  })
})

describe('parseObsConfig', () => {
  it('debería devolver los valores por defecto con entrada nula o vacía', () => {
    expect(parseObsConfig(null)).toEqual(DEFAULT_OBS_CONFIG)
    expect(parseObsConfig(undefined)).toEqual(DEFAULT_OBS_CONFIG)
    expect(parseObsConfig('')).toEqual(DEFAULT_OBS_CONFIG)
  })

  it('debería devolver los valores por defecto con JSON inválido', () => {
    expect(parseObsConfig('{no es json')).toEqual(DEFAULT_OBS_CONFIG)
    expect(parseObsConfig('123')).toEqual(DEFAULT_OBS_CONFIG)
  })

  it('debería combinar un objeto parcial sobre los defaults', () => {
    const result = parseObsConfig(JSON.stringify({ enabled: true, textColor: '#ff0000' }))
    expect(result.enabled).toBe(true)
    expect(result.textColor).toBe('#ff0000')
    expect(result.fontSize).toBe(DEFAULT_OBS_CONFIG.fontSize)
  })

  it('debería aceptar un objeto ya parseado', () => {
    const result = parseObsConfig({ position: 'top', fontSize: 60 })
    expect(result.position).toBe('top')
    expect(result.fontSize).toBe(60)
  })

  it('debería sanear valores fuera de rango', () => {
    const result = parseObsConfig(
      JSON.stringify({ backgroundOpacity: 5, fontSize: -10, maxWidth: 999, fontWeight: 5000 })
    )
    expect(result.backgroundOpacity).toBe(1)
    expect(result.fontSize).toBe(8)
    expect(result.maxWidth).toBe(100)
    expect(result.fontWeight).toBe(900)
  })

  it('debería rechazar valores de enum inválidos', () => {
    const result = parseObsConfig(
      JSON.stringify({
        position: 'diagonal',
        textAlign: 'justify',
        horizontalAlign: 'middle',
        referencePosition: 'inline'
      })
    )
    expect(result.position).toBe(DEFAULT_OBS_CONFIG.position)
    expect(result.textAlign).toBe(DEFAULT_OBS_CONFIG.textAlign)
    expect(result.horizontalAlign).toBe(DEFAULT_OBS_CONFIG.horizontalAlign)
    expect(result.referencePosition).toBe(DEFAULT_OBS_CONFIG.referencePosition)
  })

  it('debería aceptar borde de texto, indicador y posiciones válidas', () => {
    const result = parseObsConfig(
      JSON.stringify({
        horizontalAlign: 'right',
        referencePosition: 'above',
        textBorder: true,
        textBorderColor: '#123456',
        textBorderWidth: 4,
        showReference: false,
        referenceColor: '#00ff00',
        referenceFontScale: 0.8
      })
    )
    expect(result.horizontalAlign).toBe('right')
    expect(result.referencePosition).toBe('above')
    expect(result.textBorder).toBe(true)
    expect(result.textBorderColor).toBe('#123456')
    expect(result.textBorderWidth).toBe(4)
    expect(result.showReference).toBe(false)
    expect(result.referenceColor).toBe('#00ff00')
    expect(result.referenceFontScale).toBe(0.8)
  })

  it('debería sanear el grosor del borde y la escala del indicador fuera de rango', () => {
    const result = parseObsConfig(JSON.stringify({ textBorderWidth: 999, referenceFontScale: 5 }))
    expect(result.textBorderWidth).toBe(20)
    expect(result.referenceFontScale).toBe(1)
  })

  it('debería aceptar y sanear los offsets de separación del borde', () => {
    expect(parseObsConfig(JSON.stringify({ offsetX: 40, offsetY: 60 }))).toMatchObject({
      offsetX: 40,
      offsetY: 60
    })
    const clamped = parseObsConfig(JSON.stringify({ offsetX: -10, offsetY: 9999 }))
    expect(clamped.offsetX).toBe(0)
    expect(clamped.offsetY).toBe(800)
  })

  it('debería aceptar fondo transparente y CSS personalizado', () => {
    const result = parseObsConfig(
      JSON.stringify({ transparentBackground: true, customCss: '#box { color: red !important; }' })
    )
    expect(result.transparentBackground).toBe(true)
    expect(result.customCss).toBe('#box { color: red !important; }')
  })

  it('debería usar defaults para transparentBackground/customCss inválidos', () => {
    const result = parseObsConfig(JSON.stringify({ transparentBackground: 'sí', customCss: 123 }))
    expect(result.transparentBackground).toBe(false)
    expect(result.customCss).toBe('')
  })

  it('debería normalizar backgroundMediaId numérico o string, y null en otros casos', () => {
    expect(parseObsConfig(JSON.stringify({ backgroundMediaId: 12 })).backgroundMediaId).toBe(12)
    expect(parseObsConfig(JSON.stringify({ backgroundMediaId: '34' })).backgroundMediaId).toBe(34)
    expect(parseObsConfig(JSON.stringify({ backgroundMediaId: 'abc' })).backgroundMediaId).toBeNull()
    expect(parseObsConfig(JSON.stringify({ backgroundMediaId: null })).backgroundMediaId).toBeNull()
  })
})
