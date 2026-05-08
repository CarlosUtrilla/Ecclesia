// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BackgroundSelector from '../backgroundSelector'

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

vi.mock('@/screens/panels/library/media/exports', () => ({
  MediaPicker: () => null
}))

describe('BackgroundSelector', () => {
  it('deberia mostrar toggle de repeticion cuando el fondo es video seleccionado', () => {
    const onVideoLoopChange = vi.fn()

    render(
      <BackgroundSelector
        backgroundType="video"
        value="media"
        videoLoop
        onTypeChange={() => {}}
        onValueChange={() => {}}
        onVideoLoopChange={onVideoLoopChange}
        selectedMedia={
          {
            id: 7,
            name: 'video-demo',
            type: 'VIDEO',
            filePath: '/video.mp4',
            format: 'mp4',
            fileSize: 1024,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any
        }
      />
    )

    expect(screen.queryByText('Repetir')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'Repetir video de fondo' }))

    expect(onVideoLoopChange).toHaveBeenCalledWith(false)
  })

  it('no deberia mostrar toggle de repeticion cuando no hay video seleccionado', () => {
    render(
      <BackgroundSelector
        backgroundType="video"
        value=""
        onTypeChange={() => {}}
        onValueChange={() => {}}
      />
    )

    expect(screen.queryByText('Repetir')).toBeNull()
  })
})
