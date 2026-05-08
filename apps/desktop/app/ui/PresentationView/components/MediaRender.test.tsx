// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaRender from './MediaRender'

const onMediaStateMock = vi.fn()
let liveMediaCallback: ((state: { action: string; time: number }) => void) | null = null

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

describe('MediaRender', () => {
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

  it('no deberia reproducir un video live al montar sin comando play', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    render(
      <MediaRender
        live
        currentItem={
          {
            id: 'media-1',
            resourceType: 'MEDIA',
            text: '',
            name: 'Video',
            filePath: '/videos/demo.mp4',
            format: 'mp4',
            videoLoop: false
          } as never
        }
      />
    )

    expect(playSpy).not.toHaveBeenCalled()

    liveMediaCallback?.({ action: 'play', time: 0 })

    expect(playSpy).toHaveBeenCalledTimes(1)
    playSpy.mockRestore()
  })

  it('no deberia volver a 0 cuando recibe play repetido y el video ya avanzo', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    const { container } = render(
      <MediaRender
        live
        currentItem={
          {
            id: 'media-2',
            resourceType: 'MEDIA',
            text: '',
            name: 'Video',
            filePath: '/videos/demo.mp4',
            format: 'mp4',
            videoLoop: false
          } as never
        }
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
