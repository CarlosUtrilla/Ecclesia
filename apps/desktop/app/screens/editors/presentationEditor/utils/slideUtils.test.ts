import { describe, expect, it } from 'vitest'
import {
  buildCanvasItemStyle,
  cloneSlideForDuplication,
  createMediaSlide,
  getShapeTypeFromAccessData,
  parseCanvasItemStyle,
  createTextSlide,
  withVideoLiveBehavior
} from './slideUtils'

describe('cloneSlideForDuplication', () => {
  it('deberia duplicar slide sin copiar metadatos de Canva ni IDs', () => {
    const source = {
      ...createTextSlide(),
      slideName: 'Intro de adoracion',
      canvaSourceKey: 'evento-canva',
      canvaSlideNumber: 3
    }

    const duplicated = cloneSlideForDuplication(source)

    expect(duplicated.id).not.toBe(source.id)
    expect(duplicated.slideName).toBe(source.slideName)
    expect(duplicated.canvaSourceKey).toBeUndefined()
    expect(duplicated.canvaSlideNumber).toBeUndefined()

    const sourceItemIds = (source.items || []).map((item) => item.id)
    const duplicatedItemIds = (duplicated.items || []).map((item) => item.id)

    expect(duplicatedItemIds.length).toBe(sourceItemIds.length)
    expect(duplicatedItemIds.some((id) => sourceItemIds.includes(id))).toBe(false)
  })
})

describe('shape styles', () => {
  it('deberia serializar y parsear estilos de formas', () => {
    const serialized = buildCanvasItemStyle(
      {
        x: 100,
        y: 120,
        width: 240,
        height: 140,
        rotation: 12,
        fontSize: 48,
        fontFamily: 'Arial',
        lineHeight: 1.2,
        letterSpacing: 0,
        color: '#000000',
        textAlign: 'center',
        verticalAlign: 'center',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        shapeFill: 'rgba(255, 0, 0, 0.25)',
        shapeStroke: '#ff0000',
        shapeStrokeWidth: 6,
        shapeOpacity: 0.7
      },
      'SHAPE'
    )

    const parsed = parseCanvasItemStyle(serialized, 'SHAPE')

    expect(parsed.shapeFill).toBe('rgba(255, 0, 0, 0.25)')
    expect(parsed.shapeStroke).toBe('#ff0000')
    expect(parsed.shapeStrokeWidth).toBe(6)
    expect(parsed.shapeOpacity).toBe(0.7)
    expect(parsed.fontSize).toBe(48)
    expect(parsed.color).toBe('#000000')
    expect(parsed.textAlign).toBe('center')
  })

  it('deberia resolver los nuevos tipos de shapes desde accessData', () => {
    expect(getShapeTypeFromAccessData('line-arrow')).toBe('line-arrow')
    expect(getShapeTypeFromAccessData('triangle')).toBe('triangle')
    expect(getShapeTypeFromAccessData('line')).toBe('line')
    expect(getShapeTypeFromAccessData('cross')).toBe('cross')
    expect(getShapeTypeFromAccessData('desconocido')).toBe('rectangle')
  })
})

describe('slide factories', () => {
  it('deberia crear slides de video sin repetición por defecto', () => {
    const mediaSlide = createMediaSlide(15)

    expect(mediaSlide.videoLoop).toBe(false)
    expect(mediaSlide.videoLiveBehavior).toBe('manual')
  })

  it('deberia permitir configurar inicio automatico para flujos especificos como Canva', () => {
    const manualSlide = createMediaSlide(15)
    const autoSlide = withVideoLiveBehavior(manualSlide, 'auto')

    expect(manualSlide.videoLiveBehavior).toBe('manual')
    expect(autoSlide.videoLiveBehavior).toBe('auto')
  })
})
