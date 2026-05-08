import { describe, expect, it } from 'vitest'
import { computeSnappedMovePosition } from './useCanvasSnapping'

describe('useCanvasSnapping', () => {
  it('deberia hacer snap al centro del slide en coordenadas base del canvas', () => {
    const snapped = computeSnappedMovePosition({
      itemId: 'item-1',
      proposedX: 586,
      proposedY: 200,
      width: 100,
      height: 100,
      baseWidth: 1280,
      baseHeight: 720,
      parsedItems: [],
      snapThreshold: 12
    })

    expect(snapped.x).toBe(590)
    expect(snapped.guideX).toBe(640)
    expect(snapped.guideXSource).toBe('slide')
  })

  it('deberia snapear contra el centro de otro item', () => {
    const snapped = computeSnappedMovePosition({
      itemId: 'moving-item',
      proposedX: 338,
      proposedY: 300,
      width: 100,
      height: 100,
      baseWidth: 1280,
      baseHeight: 720,
      parsedItems: [
        {
          item: {
            id: 'target-item',
            type: 'TEXT',
            text: 'Target',
            accessData: '',
            layer: 0,
            customStyle: '',
            animationSettings: undefined
          },
          style: {
            x: 300,
            y: 100,
            width: 200,
            height: 80,
            rotation: 0,
            fontSize: 24,
            fontFamily: 'Arial',
            lineHeight: 1.2,
            letterSpacing: 0,
            color: '#000000',
            textAlign: 'center',
            verticalAlign: 'center',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none'
          }
        }
      ],
      snapThreshold: 12
    })

    expect(snapped.x).toBe(350)
    expect(snapped.guideX).toBe(400)
    expect(snapped.guideXSource).toBe('item')
    expect(snapped.guideXTargetItemId).toBe('target-item')
  })
})
