import { describe, it, expect } from 'vitest'
import { extractOverlayText, extractOverlayReference, htmlToPlainText } from './presentationOverlayText'
import type { PresentationViewItems } from '@/ui/PresentationView/types'

describe('htmlToPlainText', () => {
  it('debería devolver cadena vacía con nulo/undefined/vacío', () => {
    expect(htmlToPlainText(undefined)).toBe('')
    expect(htmlToPlainText(null)).toBe('')
    expect(htmlToPlainText('')).toBe('')
  })

  it('debería quitar etiquetas y conservar saltos de párrafo y <br>', () => {
    expect(htmlToPlainText('<p>Línea 1</p><p>Línea 2</p>')).toBe('Línea 1\nLínea 2')
    expect(htmlToPlainText('Hola<br/>mundo')).toBe('Hola\nmundo')
  })

  it('debería decodificar entidades y colapsar espacios', () => {
    expect(htmlToPlainText('<p>Dios&nbsp;&amp;   hombre</p>')).toBe('Dios & hombre')
  })
})

const baseSlide = (over: Partial<PresentationViewItems>): PresentationViewItems => ({
  text: '',
  resourceType: 'PRESENTATION',
  ...over
})

describe('extractOverlayText', () => {
  it('debería devolver vacío si no hay slide', () => {
    expect(extractOverlayText(undefined, 0)).toBe('')
  })

  it('debería omitir slides de medio (imagen/vídeo)', () => {
    const slide = baseSlide({ resourceType: 'MEDIA', media: { id: 1, name: 'x', type: 'VIDEO', filePath: 'v.mp4' } })
    expect(extractOverlayText(slide, 0)).toBe('')
  })

  it('debería extraer texto plano de un slide de canción', () => {
    const slide = baseSlide({ text: '<p>Cristo vive</p><p>aleluya</p>' })
    expect(extractOverlayText(slide, 0)).toBe('Cristo vive\naleluya')
  })

  it('debería usar el chunk activo de un slide bíblico directo', () => {
    const slide = baseSlide({
      resourceType: 'BIBLE',
      text: '1 texto completo',
      verse: { bookId: 40, chapter: 4, verse: 23, version: 'RVR1960' },
      chunks: [
        { book: 40, chapter: 4, verse: 23, content: 'Y recorrió Jesús toda Galilea' },
        { book: 40, chapter: 4, verse: 23, content: 'sanando toda enfermedad' }
      ]
    })
    expect(extractOverlayText(slide, 0)).toBe('Y recorrió Jesús toda Galilea')
    expect(extractOverlayText(slide, 0, { 'slide-0': 2 })).toBe('sanando toda enfermedad')
  })

  it('debería concatenar capas de texto/biblia y omitir capas de medio', () => {
    const slide = baseSlide({
      id: 's1',
      resourceType: 'PRESENTATION',
      presentationItems: [
        { id: 'l1', text: '', resourceType: 'MEDIA', media: { id: 9, name: 'bg', type: 'IMAGE', filePath: 'bg.jpg' } },
        { id: 'l2', text: '<p>Título de la diapositiva</p>', resourceType: 'PRESENTATION' },
        {
          id: 'l3',
          text: '23 completo',
          resourceType: 'BIBLE',
          verse: { bookId: 40, chapter: 4, verse: 23, version: 'RVR1960' },
          chunks: [{ book: 40, chapter: 4, verse: 23, content: 'texto del versículo' }]
        }
      ]
    })
    expect(extractOverlayText(slide, 0, { s1: 1 })).toBe('Título de la diapositiva\ntexto del versículo')
  })

  it('debería caer al texto del slide bíblico cuando no hay chunks', () => {
    const slide = baseSlide({
      resourceType: 'BIBLE',
      text: '<p>Versículo sin chunks</p>',
      verse: { bookId: 1, chapter: 1, verse: 1, version: 'RVR1960' }
    })
    expect(extractOverlayText(slide, 0)).toBe('Versículo sin chunks')
  })
})

describe('extractOverlayReference', () => {
  const resolveBook = () => 'Jn'

  it('debería devolver vacío para slides no bíblicos', () => {
    expect(extractOverlayReference(undefined, 0, undefined, resolveBook)).toBe('')
    expect(extractOverlayReference(baseSlide({ text: '<p>Canción</p>' }), 0, undefined, resolveBook)).toBe('')
  })

  it('debería construir la referencia con el verso del chunk activo', () => {
    const slide = baseSlide({
      resourceType: 'BIBLE',
      text: 'texto',
      verse: { bookId: 43, chapter: 3, verse: 16, verseEnd: 17, version: 'RVR1960' },
      chunks: [
        { book: 43, chapter: 3, verse: 16, content: 'Porque de tal manera...' },
        { book: 43, chapter: 3, verse: 17, content: 'Porque no envió Dios...' }
      ]
    })
    // El badge muestra el rango restante mientras no se llegue al último verso
    expect(extractOverlayReference(slide, 0, undefined, resolveBook)).toBe('Jn 3:16-17')
    expect(extractOverlayReference(slide, 0, { 'slide-0': 2 }, resolveBook)).toBe('Jn 3:17')
  })

  it('debería resolver la referencia desde una capa bíblica de presentación', () => {
    const slide = baseSlide({
      id: 's1',
      resourceType: 'PRESENTATION',
      presentationItems: [
        {
          id: 'l1',
          text: 't',
          resourceType: 'BIBLE',
          verse: { bookId: 43, chapter: 3, verse: 16, version: 'RVR1960' },
          chunks: [{ book: 43, chapter: 3, verse: 16, content: 'texto' }]
        }
      ]
    })
    expect(extractOverlayReference(slide, 0, { s1: 1 }, resolveBook)).toBe('Jn 3:16')
  })
})
