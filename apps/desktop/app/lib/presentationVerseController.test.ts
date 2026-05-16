/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { getSlideVerseRange, resolveSlideVerse } from './presentationVerseController'

describe('presentationVerseController', () => {
  it('resuelve modo chunk para layer bíblico en presentacion', () => {
    const slide = {
      id: 'slide-1',
      resourceType: 'PRESENTATION' as const,
      text: '',
      presentationItems: [
        {
          id: 'layer-bible-1',
          resourceType: 'BIBLE' as const,
          text: '16. Porque...<br/>17. Porque...',
          verse: {
            bookId: 43,
            chapter: 3,
            verse: 16,
            verseEnd: 17,
            version: 'RVR1960'
          },
          chunks: [
            { book: 43, chapter: 3, verse: 16, content: 'Porque...' },
            { book: 43, chapter: 3, verse: 17, content: 'Porque...' }
          ]
        }
      ]
    }

    const range = getSlideVerseRange(slide)

    expect(range).toMatchObject({
      start: 1,
      end: 2,
      mode: 'chunk',
      layerId: 'layer-bible-1'
    })
  })

  it('resuelve modo chunk para slide legacy con chunks', () => {
    const slide = {
      id: 'slide-chunk-1',
      resourceType: 'PRESENTATION' as const,
      text: 'texto original',
      chunks: [
        { book: 43, chapter: 8, verse: 44, content: 'parte 1' },
        { book: 43, chapter: 8, verse: 44, content: 'parte 2' },
        { book: 43, chapter: 8, verse: 44, content: 'parte 3' }
      ],
      verse: {
        bookId: 43,
        chapter: 8,
        verse: 44,
        version: 'RVR1960'
      }
    }

    const range = getSlideVerseRange(slide)

    expect(range).toMatchObject({
      start: 1,
      end: 3,
      mode: 'chunk'
    })
  })

  it('respeta valor guardado en presentationVerseBySlideKey para modo chunk', () => {
    const slide = {
      id: 'slide-chunk-2',
      resourceType: 'PRESENTATION' as const,
      text: 'texto original',
      chunks: [
        { book: 43, chapter: 8, verse: 44, content: 'parte 1' },
        { book: 43, chapter: 8, verse: 44, content: 'parte 2' },
        { book: 43, chapter: 8, verse: 44, content: 'parte 3' }
      ],
      verse: {
        bookId: 43,
        chapter: 8,
        verse: 44,
        version: 'RVR1960'
      }
    }

    const resolved = resolveSlideVerse(slide, 0, { 'slide-chunk-2': 2 })

    expect(resolved).toMatchObject({
      current: 2,
      start: 1,
      end: 3,
      mode: 'chunk',
      slideKey: 'slide-chunk-2'
    })
  })
})
