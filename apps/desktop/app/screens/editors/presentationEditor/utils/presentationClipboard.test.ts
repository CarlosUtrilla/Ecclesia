import { describe, expect, it } from 'vitest'
import {
  cloneClipboardItems,
  getPastedImageFile,
  getPastedImagePayload
} from './presentationClipboard'
import { buildCanvasItemStyle, PresentationSlideItem } from './slideUtils'

describe('presentationClipboard', () => {
  it('devuelve el primer archivo de imagen desde clipboard', () => {
    const imageFile = new File(['image-bytes'], 'photo.png', { type: 'image/png' })
    const textFile = new File(['hola'], 'note.txt', { type: 'text/plain' })

    const event = {
      clipboardData: {
        files: [textFile, imageFile]
      }
    } as unknown as Pick<ClipboardEvent, 'clipboardData'>

    const result = getPastedImageFile(event)
    expect(result).toBe(imageFile)
  })

  it('retorna null cuando no hay imagen en clipboard', () => {
    const textFile = new File(['hola'], 'note.txt', { type: 'text/plain' })

    const event = {
      clipboardData: {
        files: [textFile]
      }
    } as unknown as Pick<ClipboardEvent, 'clipboardData'>

    expect(getPastedImageFile(event)).toBeNull()
  })

  it('devuelve payload de imagen con bytes y mimeType', async () => {
    const imageFile = new File([new Uint8Array([1, 2, 3])], 'clip.png', { type: 'image/png' })

    const event = {
      clipboardData: {
        files: [imageFile]
      }
    } as unknown as Pick<ClipboardEvent, 'clipboardData'>

    const payload = await getPastedImagePayload(event)

    expect(payload).not.toBeNull()
    expect(payload?.mimeType).toBe('image/png')
    expect(payload?.bytes).toEqual([1, 2, 3])
  })

  it('clona un item copiado con nuevo id, nueva capa y offset', () => {
    const copiedItems: PresentationSlideItem[] = [
      {
        id: 'item-original',
        type: 'TEXT',
        text: 'Hola',
        accessData: '',
        layer: 0,
        customStyle: buildCanvasItemStyle(
          {
            x: 100,
            y: 200,
            width: 400,
            height: 120,
            rotation: 0,
            fontSize: 32,
            fontFamily: 'Arial',
            lineHeight: 1.2,
            letterSpacing: 0,
            color: '#000000',
            textAlign: 'center',
            verticalAlign: 'center',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none'
          },
          'TEXT'
        ),
        animationSettings: undefined
      }
    ]

    const existingItems: PresentationSlideItem[] = [
      {
        id: 'existing-1',
        type: 'TEXT',
        text: 'Base',
        accessData: '',
        layer: 3,
        customStyle: copiedItems[0].customStyle,
        animationSettings: undefined
      }
    ]

    const cloned = cloneClipboardItems({
      copiedItems,
      existingItems,
      idGenerator: () => 'new-item-id'
    })

    expect(cloned).toHaveLength(1)
    expect(cloned[0].id).toBe('new-item-id')
    expect(cloned[0].layer).toBe(4)
    expect(cloned[0].customStyle).toContain('left: 124px')
    expect(cloned[0].customStyle).toContain('top: 224px')
  })

  it('clona múltiples items preservando orden y asignando capas consecutivas', () => {
    const copiedItems: PresentationSlideItem[] = [
      {
        id: 'a',
        type: 'TEXT',
        text: 'A',
        accessData: '',
        layer: 1,
        customStyle: buildCanvasItemStyle(
          {
            x: 200,
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
          },
          'TEXT'
        ),
        animationSettings: undefined
      },
      {
        id: 'b',
        type: 'TEXT',
        text: 'B',
        accessData: '',
        layer: 2,
        customStyle: buildCanvasItemStyle(
          {
            x: 260,
            y: 180,
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
          },
          'TEXT'
        ),
        animationSettings: undefined
      }
    ]

    const cloned = cloneClipboardItems({
      copiedItems,
      existingItems: [],
      idGenerator: (() => {
        let index = 0
        return () => `id-${++index}`
      })()
    })

    expect(cloned).toHaveLength(2)
    expect(cloned[0].id).toBe('id-1')
    expect(cloned[1].id).toBe('id-2')
    expect(cloned[0].layer).toBe(0)
    expect(cloned[1].layer).toBe(1)
    expect(cloned[0].customStyle).toContain('left: 224px')
    expect(cloned[1].customStyle).toContain('left: 284px')
  })
})
