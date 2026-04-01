// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import PresentationRender from './PresentationRender'

const bibleTextRenderSpy = vi.fn()

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

vi.mock('./BibleTextRender', () => ({
  BibleTextRender: (props: unknown) => {
    bibleTextRenderSpy(props)
    return <div data-testid="bible-layer" />
  }
}))

describe('PresentationRender', () => {
  beforeEach(() => {
    bibleTextRenderSpy.mockClear()
  })

  it('deberia propagar presentationHeight y scaleFactor reales al layer biblico', () => {
    render(
      <PresentationRender
        item={{
          id: 'slide-1',
          text: '',
          resourceType: 'PRESENTATION',
          presentationItems: [
            {
              id: 'layer-bible',
              text: 'Texto',
              resourceType: 'BIBLE',
              verse: {
                bookId: 43,
                chapter: 3,
                verse: 16,
                version: 'RVR60'
              },
              customStyle: 'font-size: 48px; color: #ffffff;'
            }
          ]
        }}
        animationType="fade"
        variants={{ initial: {}, animate: {}, exit: {} }}
        textStyle={{ fontSize: '64px' }}
        textContainerPadding={{ horizontal: 0, vertical: 0 }}
        textContainerOffset={{ x: 0, y: 0 }}
        isPreview={false}
        theme={{
          id: 1,
          name: 'Tema',
          background: '#000000',
          backgroundMediaId: null,
          previewImage: '',
          textStyle: { fontSize: 64 },
          animationSettings: '',
          transitionSettings: '',
          useDefaultBibleSettings: true,
          biblePresentationSettingsId: null,
          biblePresentationSettings: null,
          backgroundVideoLoop: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          backgroundMedia: null
        }}
        smallFontSize="81.6px"
        scaleFactor={1.5}
        presentationHeight={1080}
      />
    )

    expect(bibleTextRenderSpy).toHaveBeenCalled()
    const lastCallProps = bibleTextRenderSpy.mock.calls.at(-1)?.[0] as {
      scaleFactor: number
      presentationHeight: number
      constrainScreenVerseToSingleLine: boolean | 'auto'
      autoSplitVerseText: boolean
    }

    expect(lastCallProps.scaleFactor).toBe(1.5)
    expect(lastCallProps.presentationHeight).toBe(1080)
    expect(lastCallProps.constrainScreenVerseToSingleLine).toBe('auto')
    expect(lastCallProps.autoSplitVerseText).toBe(true)
  })

  it('deberia usar BibleTextRender para slides legacy con verse y activar modo auto por diapositiva', () => {
    render(
      <PresentationRender
        item={{
          id: 'legacy-slide-1',
          text: '16 Porque de tal manera amo Dios al mundo...',
          resourceType: 'PRESENTATION',
          verse: {
            bookId: 43,
            chapter: 3,
            verse: 16,
            version: 'RVR60'
          }
        }}
        animationType="fade"
        variants={{ initial: {}, animate: {}, exit: {} }}
        textStyle={{ fontSize: '64px' }}
        textContainerPadding={{ horizontal: 0, vertical: 0 }}
        textContainerOffset={{ x: 0, y: 0 }}
        isPreview={false}
        theme={{
          id: 1,
          name: 'Tema',
          background: '#000000',
          backgroundMediaId: null,
          previewImage: '',
          textStyle: { fontSize: 64 },
          animationSettings: '',
          transitionSettings: '',
          useDefaultBibleSettings: true,
          biblePresentationSettingsId: null,
          biblePresentationSettings: null,
          backgroundVideoLoop: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          backgroundMedia: null
        }}
        smallFontSize="81.6px"
        scaleFactor={1.25}
        presentationHeight={900}
      />
    )

    expect(bibleTextRenderSpy).toHaveBeenCalled()
    const lastCallProps = bibleTextRenderSpy.mock.calls.at(-1)?.[0] as {
      constrainScreenVerseToSingleLine: boolean | 'auto'
      presentationHeight: number
      scaleFactor: number
      autoSplitVerseText: boolean
    }

    expect(lastCallProps.constrainScreenVerseToSingleLine).toBe('auto')
    expect(lastCallProps.presentationHeight).toBe(900)
    expect(lastCallProps.scaleFactor).toBe(1.25)
    expect(lastCallProps.autoSplitVerseText).toBe(true)
  })

  it('deberia permitir prefijo de verso en primera parte de modo chunk para slide legacy', () => {
    render(
      <PresentationRender
        item={{
          id: 'legacy-chunk-1',
          text: '23 Y recorrió Jesús toda Galilea enseñando...',
          resourceType: 'PRESENTATION',
          chunkParts: ['23 Y recorrio Jesus toda Galilea...', '... sanando toda enfermedad ...'],
          verse: {
            bookId: 40,
            chapter: 4,
            verse: 23,
            version: 'RVR60'
          }
        }}
        animationType="fade"
        variants={{ initial: {}, animate: {}, exit: {} }}
        textStyle={{ fontSize: '64px' }}
        textContainerPadding={{ horizontal: 0, vertical: 0 }}
        textContainerOffset={{ x: 0, y: 0 }}
        isPreview={false}
        theme={{
          id: 1,
          name: 'Tema',
          background: '#000000',
          backgroundMediaId: null,
          previewImage: '',
          textStyle: { fontSize: 64 },
          animationSettings: '',
          transitionSettings: '',
          useDefaultBibleSettings: true,
          biblePresentationSettingsId: null,
          biblePresentationSettings: null,
          backgroundVideoLoop: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          backgroundMedia: null
        }}
        smallFontSize="81.6px"
        scaleFactor={1.25}
        presentationHeight={900}
      />
    )

    const lastCallProps = bibleTextRenderSpy.mock.calls.at(-1)?.[0] as {
      forceHideVerseNumberPrefix: boolean
    }

    expect(lastCallProps.forceHideVerseNumberPrefix).toBe(false)
  })

  it('deberia ocultar prefijo de verso en partes posteriores de modo chunk para slide legacy', () => {
    render(
      <PresentationRender
        item={{
          id: 'legacy-chunk-2',
          text: '23 Y recorrio Jesus toda Galilea enseñando...',
          resourceType: 'PRESENTATION',
          chunkParts: ['Y recorrio Jesus toda Galilea...', '... sanando toda enfermedad ...'],
          verse: {
            bookId: 40,
            chapter: 4,
            verse: 23,
            version: 'RVR60'
          }
        }}
        presentationVerseBySlideKey={{ 'legacy-chunk-2': 2 }}
        animationType="fade"
        variants={{ initial: {}, animate: {}, exit: {} }}
        textStyle={{ fontSize: '64px' }}
        textContainerPadding={{ horizontal: 0, vertical: 0 }}
        textContainerOffset={{ x: 0, y: 0 }}
        isPreview={false}
        theme={{
          id: 1,
          name: 'Tema',
          background: '#000000',
          backgroundMediaId: null,
          previewImage: '',
          textStyle: { fontSize: 64 },
          animationSettings: '',
          transitionSettings: '',
          useDefaultBibleSettings: true,
          biblePresentationSettingsId: null,
          biblePresentationSettings: null,
          backgroundVideoLoop: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          backgroundMedia: null
        }}
        smallFontSize="81.6px"
        scaleFactor={1.25}
        presentationHeight={900}
      />
    )

    const lastCallProps = bibleTextRenderSpy.mock.calls.at(-1)?.[0] as {
      forceHideVerseNumberPrefix: boolean
    }

    expect(lastCallProps.forceHideVerseNumberPrefix).toBe(true)
  })
})
