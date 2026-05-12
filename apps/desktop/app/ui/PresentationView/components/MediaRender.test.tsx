// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaRender from './MediaRender'

const onMediaStateMock = vi.fn()
let liveMediaCallback: ((state: { action: string; time: number }) => void) | null = null
let buildMediaUrlMock = (path: string) => path

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => buildMediaUrlMock(path)
  })
}))

describe('MediaRender', () => {
  beforeEach(() => {
    liveMediaCallback = null
    buildMediaUrlMock = (path: string) => path
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

  it('deberia usar mediaUrl precargado en lugar de buildMediaUrl(filePath)', () => {
    const filePathSpy = vi.fn(() => 'fallback-url')
    buildMediaUrlMock = filePathSpy

    const { container } = render(
      <MediaRender
        live
        currentItem={
          {
            id: 'media-3',
            resourceType: 'MEDIA',
            text: '',
            name: 'Video',
            filePath: '/videos/demo.mp4',
            format: 'mp4',
            videoLoop: false,
            mediaUrl: 'http://localhost:7777/media/videos/demo.mp4'
          } as never
        }
      />
    )

    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeTruthy()
    expect(video?.src).toBe('http://localhost:7777/media/videos/demo.mp4')
    // buildMediaUrl se llama para thumbnail (con ''), pero NO se usa su
    // resultado para filePath porque mediaUrl tiene prioridad.
    expect(filePathSpy).not.toHaveBeenCalledWith('/videos/demo.mp4')
  })

  it('deberia retornar null si buildMediaUrl devuelve vacio y no hay mediaUrl', () => {
    buildMediaUrlMock = () => ''

    const { container } = render(
      <MediaRender
        live
        currentItem={
          {
            id: 'media-4',
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

    const video = container.querySelector('video')
    expect(video).toBeFalsy()
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
