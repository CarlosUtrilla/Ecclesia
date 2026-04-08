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

describe('PresentationRender repeated play sync', () => {
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

  it('no deberia resetear a 0 un layer de video si recibe play repetido', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    const { container } = render(
      <PresentationRender
        item={{
          id: 'slide-video-2',
          text: '',
          resourceType: 'PRESENTATION',
          presentationItems: [
            {
              id: 'layer-video-2',
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

    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeTruthy()

    liveMediaCallback?.({ action: 'play', time: 0 })
    video.currentTime = 0.2
    liveMediaCallback?.({ action: 'play', time: 0 })

    expect(video.currentTime).toBe(0.2)
    expect(playSpy).toHaveBeenCalledTimes(2)
    playSpy.mockRestore()
  })
})
