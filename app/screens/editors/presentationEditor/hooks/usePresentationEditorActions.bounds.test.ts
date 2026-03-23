import { describe, expect, it } from 'vitest'
import { mergeBoundsWithVerse } from './usePresentationEditorActions'

describe('usePresentationEditorActions bounds merge', () => {
  it('deberia unir texto y verso desacoplado (caso y:0..10 + verso hasta y:14)', () => {
    const textBounds = { x: 0, y: 0, width: 20, height: 10 }
    const verseBounds = { x: 0, y: 10, width: 20, height: 4 } // termina en y:14

    const merged = mergeBoundsWithVerse(textBounds, verseBounds)

    expect(merged.x).toBe(0)
    expect(merged.y).toBe(0)
    // La unión geométrica llega a y:14; actualmente el estilo aplica mínimo de alto 60.
    expect(merged.height).toBe(60)
  })

  it('deberia extender hacia arriba cuando el verso queda sobre el texto', () => {
    const textBounds = { x: 100, y: 40, width: 200, height: 120 }
    const verseBounds = { x: 120, y: 10, width: 160, height: 20 }

    const merged = mergeBoundsWithVerse(textBounds, verseBounds)

    expect(merged.y).toBe(10)
    expect(merged.width).toBe(200)
    expect(merged.height).toBe(150)
  })

  it('deberia mantener bounds de texto si no hay verso desacoplado', () => {
    const textBounds = { x: 200, y: 100, width: 500, height: 240 }

    const merged = mergeBoundsWithVerse(textBounds, null)

    expect(merged).toEqual(textBounds)
  })
})
