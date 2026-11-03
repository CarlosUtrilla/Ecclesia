// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import usePresentationVideoController from './usePresentationVideoController'

vi.mock('../useRemoteVideoSync', () => ({
  default: ({ state, handlers }: { state: unknown; handlers: unknown }) => ({ state, handlers })
}))

describe('usePresentationVideoController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('deberia hacer seek solo una vez y reintentar con play al autoiniciar', () => {
    const sendLiveMediaState = vi.fn()
    const controllerVideoRef = createRef<HTMLVideoElement | null>()

    renderHook(() =>
      usePresentationVideoController({
        controllerVideoRef,
        sendLiveMediaState,
        activeSlideHasVideo: true,
        activeSlideVideoBehavior: 'auto',
        activeVideoDurationHint: 0,
        activeVideoUrl: 'http://localhost/video.mp4',
        activeVideoPath: 'files/video.mp4',
        activeSlideVideoLoop: false,
        liveScreensReady: true,
        slideIndex: 0
      })
    )

    expect(sendLiveMediaState).toHaveBeenNthCalledWith(1, { action: 'seek', time: 0, path: 'files/video.mp4' })
    expect(sendLiveMediaState).toHaveBeenNthCalledWith(2, { action: 'play', time: 0, path: 'files/video.mp4' })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(sendLiveMediaState).toHaveBeenCalledTimes(4)
    expect(sendLiveMediaState).toHaveBeenNthCalledWith(3, { action: 'play', time: 0, path: 'files/video.mp4' })
    expect(sendLiveMediaState).toHaveBeenNthCalledWith(4, { action: 'play', time: 0, path: 'files/video.mp4' })

    const seekCalls = sendLiveMediaState.mock.calls.filter(
      ([payload]) => payload?.action === 'seek'
    )
    expect(seekCalls).toHaveLength(1)
  })
})
