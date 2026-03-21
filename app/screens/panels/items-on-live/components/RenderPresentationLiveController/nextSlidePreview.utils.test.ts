import { describe, expect, it } from 'vitest'
import { buildNextSlideFallbackPreview, stripHtmlForPreview, trimPreviewText } from './nextSlidePreview.utils'

describe('nextSlidePreview.utils', () => {
  it('deberia limpiar HTML para preview', () => {
    expect(stripHtmlForPreview('<p>Hola <strong>mundo</strong></p>')).toBe('Hola mundo')
  })

  it('deberia truncar texto largo', () => {
    const text = 'a'.repeat(200)
    const preview = trimPreviewText(text, 20)
    expect(preview).toBe('aaaaaaaaaaaaaaaaaaaa...')
  })

  it('deberia usar texto principal en slide de texto', () => {
    const preview = buildNextSlideFallbackPreview({
      resourceType: 'TEXT',
      text: 'Proximo texto de prueba'
    } as any)

    expect(preview).toBe('Proximo texto de prueba')
  })

  it('deberia construir preview de layers en presentacion', () => {
    const preview = buildNextSlideFallbackPreview({
      resourceType: 'PRESENTATION',
      text: '',
      presentationItems: [
        { id: '1', text: 'Linea 1', resourceType: 'TEXT' },
        { id: '2', text: 'Linea 2', resourceType: 'TEXT' }
      ]
    } as any)

    expect(preview).toContain('Linea 1')
    expect(preview).toContain('Linea 2')
  })

  it('deberia indicar no hay siguiente diapositiva', () => {
    expect(buildNextSlideFallbackPreview(undefined)).toBe('No hay siguiente diapositiva')
  })
})
