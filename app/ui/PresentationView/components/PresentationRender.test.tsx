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
    }

    expect(lastCallProps.scaleFactor).toBe(1.5)
    expect(lastCallProps.presentationHeight).toBe(1080)
  })
})
