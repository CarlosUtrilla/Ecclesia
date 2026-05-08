import { describe, expect, it } from 'vitest'
import {
  applyPresentationBibleOverrides,
  buildPresentationBibleOverrideKey,
  getPresentationBibleTargets,
  getPresentationBibleVersion
} from './presentationBibleVersionOverrides'
import { PresentationViewItems } from '@/ui/PresentationView/types'

describe('presentationBibleVersionOverrides', () => {
  it('debería detectar un slide bíblico directo', () => {
    const slide: PresentationViewItems = {
      id: 'slide-1',
      text: '16. Porque de tal manera amó Dios al mundo',
      verse: {
        bookId: 43,
        chapter: 3,
        verse: 16,
        version: 'RVR1960'
      },
      resourceType: 'BIBLE'
    }

    expect(getPresentationBibleTargets(slide, 0)).toEqual([
      {
        overrideKey: buildPresentationBibleOverrideKey('slide-1'),
        version: 'RVR1960',
        bookId: 43,
        chapter: 3,
        verseStart: 16,
        verseEnd: 16
      }
    ])
    expect(getPresentationBibleVersion(slide, 0)).toBe('RVR1960')
  })

  it('debería detectar layers bíblicos dentro de una presentación', () => {
    const slide: PresentationViewItems = {
      id: 'slide-2',
      text: '',
      resourceType: 'PRESENTATION',
      presentationItems: [
        {
          id: 'layer-text',
          text: 'Título',
          resourceType: 'TEXT'
        },
        {
          id: 'layer-bible',
          text: '16. Porque de tal manera amó Dios al mundo<br/>17. Porque no envió Dios...',
          resourceType: 'BIBLE',
          verse: {
            bookId: 43,
            chapter: 3,
            verse: 16,
            verseEnd: 17,
            version: 'NTV'
          }
        }
      ]
    }

    expect(getPresentationBibleTargets(slide, 1)).toEqual([
      {
        overrideKey: buildPresentationBibleOverrideKey('slide-2', 'layer-bible'),
        version: 'NTV',
        bookId: 43,
        chapter: 3,
        verseStart: 16,
        verseEnd: 17
      }
    ])
  })

  it('debería aplicar overrides sobre slides y layers bíblicos', () => {
    const slides: PresentationViewItems[] = [
      {
        id: 'slide-1',
        text: '16. Porque de tal manera amó Dios al mundo',
        verse: {
          bookId: 43,
          chapter: 3,
          verse: 16,
          version: 'RVR1960'
        },
        resourceType: 'BIBLE'
      },
      {
        id: 'slide-2',
        text: '',
        resourceType: 'PRESENTATION',
        presentationItems: [
          {
            id: 'layer-bible',
            text: '16. Porque de tal manera amó Dios al mundo',
            resourceType: 'BIBLE',
            verse: {
              bookId: 43,
              chapter: 3,
              verse: 16,
              version: 'RVR1960'
            }
          }
        ]
      }
    ]

    const nextSlides = applyPresentationBibleOverrides(slides, {
      [buildPresentationBibleOverrideKey('slide-1')]: {
        version: 'NTV',
        text: '16. Pues Dios amó tanto al mundo'
      },
      [buildPresentationBibleOverrideKey('slide-2', 'layer-bible')]: {
        version: 'DHH',
        text: '16. Pues Dios amó tanto al mundo'
      }
    })

    expect(nextSlides[0].verse?.version).toBe('NTV')
    expect(nextSlides[0].text).toBe('16. Pues Dios amó tanto al mundo')
    expect(nextSlides[1].presentationItems?.[0].verse?.version).toBe('DHH')
    expect(nextSlides[1].presentationItems?.[0].text).toBe('16. Pues Dios amó tanto al mundo')
  })
})