/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { getSlideVerseRange, resolveSlideVerse } from './presentationVerseController'

describe('presentationVerseController', () => {
  it('resuelve modo verse para layer bíblico con rango', () => {
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
          }
        }
      ]
    }

    const range = getSlideVerseRange(slide)

    expect(range).toMatchObject({
      start: 16,
      end: 17,
      mode: 'verse',
      layerId: 'layer-bible-1'
    })
  })

  it('resuelve modo chunk para slide legacy con chunkParts', () => {
    const slide = {
      id: 'slide-chunk-1',
      resourceType: 'PRESENTATION' as const,
      text: 'texto original',
      chunkParts: ['parte 1', 'parte 2', 'parte 3'],
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
      chunkParts: ['parte 1', 'parte 2', 'parte 3'],
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
