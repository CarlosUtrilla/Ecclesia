import { describe, expect, it } from 'vitest'
import { isDocumentMediaType, isPresentationLikeMedia } from './liveRenderTarget'

const mediaItem = (accessData: string) => ({ type: 'MEDIA' as const, accessData })

describe('isPresentationLikeMedia', () => {
  it('reconoce el contenido marcado como presentación sin mirar el cache de media', () => {
    // Caso del PPTX enviado a live directo desde la biblioteca: no está en `media`
    expect(isPresentationLikeMedia(mediaItem('7'), { renderAs: 'presentation' }, [])).toBe(true)
  })

  it('reconoce un PPTX del cronograma por su tipo de media', () => {
    expect(
      isPresentationLikeMedia(mediaItem('7'), {}, [{ id: 7, type: 'PPTX' }])
    ).toBe(true)
  })

  it('reconoce un PDF del cronograma por su tipo de media', () => {
    expect(isPresentationLikeMedia(mediaItem('7'), {}, [{ id: 7, type: 'PDF' }])).toBe(true)
  })

  it('un video o imagen no se controla como presentación', () => {
    expect(isPresentationLikeMedia(mediaItem('7'), {}, [{ id: 7, type: 'VIDEO' }])).toBe(false)
    expect(isPresentationLikeMedia(mediaItem('7'), {}, [{ id: 7, type: 'IMAGE' }])).toBe(false)
  })

  it('sin marca ni media en cache, no asume presentación', () => {
    expect(isPresentationLikeMedia(mediaItem('7'), {}, [])).toBe(false)
    expect(isPresentationLikeMedia(mediaItem('7'), null, [])).toBe(false)
    expect(isPresentationLikeMedia(mediaItem('7'), undefined, undefined)).toBe(false)
  })

  it('solo aplica a items de tipo MEDIA', () => {
    expect(
      isPresentationLikeMedia(
        { type: 'PRESENTATION', accessData: '7' },
        { renderAs: 'presentation' },
        []
      )
    ).toBe(false)
    expect(isPresentationLikeMedia(null, { renderAs: 'presentation' }, [])).toBe(false)
  })
})

describe('isDocumentMediaType', () => {
  it('distingue los tipos que se proyectan como diapositivas', () => {
    expect(isDocumentMediaType('PDF')).toBe(true)
    expect(isDocumentMediaType('PPTX')).toBe(true)
    expect(isDocumentMediaType('VIDEO')).toBe(false)
    expect(isDocumentMediaType(null)).toBe(false)
    expect(isDocumentMediaType(undefined)).toBe(false)
  })
})
