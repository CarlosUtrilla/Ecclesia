// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationRender from './PresentationRender'

const onMediaStateMock = vi.fn()
let liveMediaCallback: ((state: { action: string; time: number }) => void) | null = null

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

const theme = {
  id: 1,
  name: 'Tema',
  background: '#000000',
  backgroundBlur: 0,
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
} as never

const renderSlide = (videoLiveBehavior?: 'auto' | 'manual') =>
  render(
    <PresentationRender
      item={{
        id: 'slide-video-auto',
        text: '',
        resourceType: 'PRESENTATION',
        videoLiveBehavior,
        presentationItems: [
          {
            id: 'layer-video-auto',
            text: '',
            resourceType: 'MEDIA',
            media: {
              id: 1,
              name: 'Video',
              type: 'VIDEO',
              filePath: '/videos/demo.mp4',
              thumbnail: '/videos/demo.jpg'
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
      theme={theme}
    />
  )

describe('PresentationRender video auto play', () => {
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

  it('deberia reproducir el video al montar cuando la diapositiva es automatica', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    renderSlide('auto')

    expect(playSpy).toHaveBeenCalledTimes(1)
    playSpy.mockRestore()
  })

  it('deberia usar el thumbnail como poster para no dejar la pantalla vacia', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    const { container } = renderSlide('auto')
    const video = container.querySelector('video') as HTMLVideoElement

    expect(video.getAttribute('poster')).toBe('/videos/demo.jpg')
    playSpy.mockRestore()
  })

  it('deberia reintentar el play en canplay si el video aun no tenia datos', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.reject(new Error('AbortError')))

    const { container } = renderSlide('auto')
    const video = container.querySelector('video') as HTMLVideoElement

    expect(playSpy).toHaveBeenCalledTimes(1)

    fireEvent.canPlay(video)

    expect(playSpy).toHaveBeenCalledTimes(2)
    playSpy.mockRestore()
  })

  it('no deberia reintentar el play si el controlador pidio pausa', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    const { container } = renderSlide('auto')
    const video = container.querySelector('video') as HTMLVideoElement

    liveMediaCallback?.({ action: 'pause', time: 0 })
    fireEvent.canPlay(video)

    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    playSpy.mockRestore()
    pauseSpy.mockRestore()
  })

  it('no deberia reproducir al montar cuando la diapositiva es manual', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    const { container } = renderSlide('manual')
    const video = container.querySelector('video') as HTMLVideoElement

    expect(playSpy).not.toHaveBeenCalled()

    fireEvent.canPlay(video)

    expect(playSpy).not.toHaveBeenCalled()
    playSpy.mockRestore()
  })
})
