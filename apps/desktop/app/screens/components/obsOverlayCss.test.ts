import { describe, expect, it } from 'vitest'
import { buildGeneratedCss } from './ObsTextOutputDialog'
import { DEFAULT_OBS_CONFIG } from '@ecclesia/api/src/controllers/obs/obsOverlayConfig'

const css = (overrides = {}) => buildGeneratedCss({ ...DEFAULT_OBS_CONFIG, ...overrides })

describe('buildGeneratedCss', () => {
  it('emite px sobre el lienzo virtual, no unidades de viewport', () => {
    const out = css({ fontSize: 48, paddingX: 32, paddingY: 20 })

    // El preview y la página /obs montan el mismo lienzo de 1920x1080 escalado,
    // así que los valores del editor son px literales. Con vh/cqh cada
    // superficie resolvía contra una altura distinta y divergían.
    expect(out).toContain('font-size: 48px;')
    expect(out).toContain('padding: 20px 32px;')
    expect(out).toContain('border-radius: 4px;')
  })

  it('no deja ninguna unidad relativa al viewport ni al contenedor', () => {
    const out = css({
      textShadow: true,
      textBorder: true,
      textBorderWidth: 2,
      position: 'top',
      offsetY: 40,
      horizontalAlign: 'left',
      offsetX: 60
    })

    expect(out).not.toMatch(/\d(vh|vw|cqh|cqw)\b/)
    expect(out).toContain('margin: 40px 0 0 60px;')
    expect(out).toContain('-webkit-text-stroke: 2px')
  })

  it('mantiene maxWidth en porcentaje: es relativo al ancho del lienzo', () => {
    expect(css({ maxWidth: 90 })).toContain('max-width: 90%;')
  })
})
