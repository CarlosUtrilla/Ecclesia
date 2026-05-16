// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationRender from './PresentationRender'

const onMediaStateMock = vi.fn()
let liveMediaCallback: ((state: { action: string; time: number }) => void) | null = null

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

describe('PresentationRender video sync', () => {
  beforeEach(() => {
    liveMediaCallback = null
    onMediaStateMock.mockImplementation(
      (callback: (state: { action: string; time: number }) => void) => {
        liveMediaCallback = callback
        return vi.fn()
      }
    )
    window.liveMediaAPI = {
      onMediaState: onMediaStateMock
    } as never
  })

  it('no deberia reproducir el video de un layer al montar sin comando play', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    render(
      <PresentationRender
        item={{
          id: 'slide-video-1',
          text: '',
          resourceType: 'PRESENTATION',
          presentationItems: [
            {
              id: 'layer-video-1',
              text: '',
              resourceType: 'MEDIA',
              media: {
                id: 1,
                name: 'Video',
                type: 'VIDEO',
                filePath: '/videos/demo.mp4'
              }
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
      />
    )

    expect(playSpy).not.toHaveBeenCalled()

    liveMediaCallback?.({ action: 'play', time: 0 })

    expect(playSpy).toHaveBeenCalledTimes(1)
    playSpy.mockRestore()
  })
})
