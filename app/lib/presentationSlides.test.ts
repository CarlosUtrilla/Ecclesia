/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { BlankTheme } from '@/hooks/useThemes'
import {
  attachPresentationBibleChunkParts,
  presentationSlideToViewItem,
  resolvePresentationSlideTheme
} from './presentationSlides'
import type { ThemeWithMedia } from '@/ui/PresentationView/types'
import type { PresentationSlide } from 'database/controllers/presentations/presentations.dto'

const buildSlide = (partial?: Partial<PresentationSlide>): PresentationSlide => ({
  id: 'slide-1',
  type: 'TEXT',
  text: 'Texto',
  ...partial
})

describe('resolvePresentationSlideTheme', () => {
  it('crea un override desde BlankTheme cuando la diapositiva solo define backgroundColor', () => {
    const resolvedTheme = resolvePresentationSlideTheme(
      buildSlide({ backgroundColor: '#123456' }),
      new Map()
    )

    expect(resolvedTheme).toMatchObject({
      ...BlankTheme,
      background: '#123456',
      backgroundMediaId: null,
      backgroundMedia: null
    })
  })

  it('mantiene el tema base y sustituye media por color cuando existe override por slide', () => {
    const baseTheme = {
      ...BlankTheme,
      id: 9,
      name: 'Tema con video',
      background: 'media',
      backgroundMediaId: 22,
      backgroundMedia: {
        id: 22,
        name: 'bg.mp4',
        filePath: '/tmp/bg.mp4',
        type: 'VIDEO',
        thumbnail: '/tmp/bg.jpg',
        duration: 8,
        format: 'mp4',
        createdAt: new Date(),
        updatedAt: new Date(),
        folderId: null
      }
    } as ThemeWithMedia

    const resolvedTheme = resolvePresentationSlideTheme(
      buildSlide({ themeId: 9, backgroundColor: '#abcdef' }),
      new Map([[9, baseTheme]])
    )

    expect(resolvedTheme).toMatchObject({
      id: 9,
      name: 'Tema con video',
      background: '#abcdef',
      backgroundMediaId: null,
      backgroundMedia: null
    })
  })
})

describe('presentationSlideToViewItem', () => {
  it('propaga el override de fondo al item renderizable', () => {
    const item = presentationSlideToViewItem(
      buildSlide({ backgroundColor: '#0f0f0f' }),
      new Map(),
      new Map()
    )

    expect(item.theme?.background).toBe('#0f0f0f')
    expect(item.resourceType).toBe('PRESENTATION')
  })

  it('propaga la configuración de repetición del video', () => {
    const item = presentationSlideToViewItem(
      buildSlide({ type: 'MEDIA', mediaId: 4, videoLoop: true }),
      new Map([
        [
          4,
          {
            id: 4,
            name: 'clip.mp4',
            filePath: '/tmp/clip.mp4',
            type: 'VIDEO',
            thumbnail: '/tmp/clip.jpg',
            duration: 4,
            format: 'mp4',
            createdAt: new Date(),
            updatedAt: new Date(),
            folderId: null
          }
        ]
      ]),
      new Map()
    )

    expect(item.videoLoop).toBe(true)
    expect(item.resourceType).toBe('MEDIA')
  })
})

describe('attachPresentationBibleChunkParts', () => {
  it('adjunta chunkParts para slides legacy de biblia en presentación', () => {
    const slides = attachPresentationBibleChunkParts(
      [
        {
          id: 'legacy-1',
          resourceType: 'PRESENTATION',
          text: 'Vosotros sois de vuestro padre el diablo, y los deseos de vuestro padre queréis hacer. El ha sido homicida desde el principio, y no ha permanecido en la verdad, porque no hay verdad en él. Cuando habla mentira, de suyo habla; porque es mentiroso, y padre de mentira.',
          verse: {
            bookId: 43,
            chapter: 8,
            verse: 44,
            version: 'RVR1960'
          }
        }
      ],
      120
    )

    expect(slides[0].chunkParts).toBeDefined()
    expect(slides[0].chunkParts!.length).toBeGreaterThan(1)
  })

  it('elimina numeración incrustada al inicio antes de chunkear', () => {
    const slides = attachPresentationBibleChunkParts(
      [
        {
          id: 'legacy-2',
          resourceType: 'PRESENTATION',
          text: '23... Y recorría Jesús toda Galilea enseñando en las sinagogas de ellos, y predicando el evangelio del reino, y sanando toda enfermedad y toda dolencia en el pueblo.',
          verse: {
            bookId: 40,
            chapter: 4,
            verse: 23,
            version: 'RVR1960'
          }
        }
      ],
      80
    )

    const firstChunk = slides[0].chunkParts?.[0] || ''
    expect(firstChunk.startsWith('23')).toBe(false)
  })

  it('adjunta chunkParts para layer bíblico dentro de presentationItems', () => {
    const slides = attachPresentationBibleChunkParts(
      [
        {
          id: 'layered-1',
          resourceType: 'PRESENTATION',
          text: '',
          presentationItems: [
            {
              id: 'layer-text-1',
              resourceType: 'TEXT',
              text: 'Título'
            },
            {
              id: 'layer-bible-1',
              resourceType: 'BIBLE',
              text: 'Vosotros sois de vuestro padre el diablo, y los deseos de vuestro padre queréis hacer. El ha sido homicida desde el principio, y no ha permanecido en la verdad, porque no hay verdad en él. Cuando habla mentira, de suyo habla; porque es mentiroso, y padre de mentira.',
              verse: {
                bookId: 43,
                chapter: 8,
                verse: 44,
                version: 'RVR1960'
              }
            }
          ]
        }
      ],
      120
    )

    const bibleLayer = slides[0].presentationItems?.find((layer) => layer.id === 'layer-bible-1')
    expect(bibleLayer?.chunkParts).toBeDefined()
    expect(bibleLayer?.chunkParts?.length).toBeGreaterThan(1)
  })
})