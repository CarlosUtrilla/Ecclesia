// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RenderMedia } from './RenderMedia'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

const useScheduleMock = vi.fn()
const useLiveMock = vi.fn()

vi.mock('@/contexts/ScheduleContext', () => ({
  useSchedule: () => useScheduleMock()
}))

vi.mock('@/contexts/ScheduleContext/utils/liveContext', () => ({
  useLive: () => useLiveMock()
}))

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: undefined })
}))

vi.mock('@ecclesia/queries', () => ({
  Api: { query: { media: { getMediaByIds: vi.fn().mockReturnValue({}) } } }
}))

describe('RenderMedia', () => {
  beforeEach(() => {
    useScheduleMock.mockReset()
    useLiveMock.mockReset()
  })

  it('reproduce el video automáticamente cuando liveScreensReady ya está activo', async () => {
    const mediaItems = [
      { id: 1, type: 'VIDEO', name: 'video-1', filePath: '/videos/1.mp4' },
      { id: 2, type: 'VIDEO', name: 'video-2', filePath: '/videos/2.mp4' }
    ]

    let itemOnLive = { type: 'MEDIA', accessData: '1' }

    useScheduleMock.mockImplementation(() => ({
      itemOnLive,
      media: mediaItems
    }))

    useLiveMock.mockReturnValue({
      liveScreensReady: true,
      sendLiveMediaState: vi.fn()
    })

    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    const { rerender } = render(<RenderMedia />)

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(1)
    })

    itemOnLive = { type: 'MEDIA', accessData: '2' }
    useScheduleMock.mockImplementation(() => ({
      itemOnLive,
      media: mediaItems
    }))

    rerender(<RenderMedia />)

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(2)
    })

    playSpy.mockRestore()
  })
})
