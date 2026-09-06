// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PresentationView } from '.'
import { ThemeWithMedia } from './types'

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({
    buildMediaUrl: (path: string) => path
  })
}))

vi.mock('@/hooks/useTagSongs', () => ({
  default: () => ({ tagSongs: [] })
}))

vi.mock('@/hooks/useBibleSchema', () => ({
  default: () => ({ bibleSchema: [] })
}))

vi.mock('@/contexts/ScreenSizeContext', () => ({
  useScreenSize: () => ({ width: 1920, height: 1080, aspectRatio: '16 / 9' })
}))

const fadeTheme: ThemeWithMedia = {
  id: 7,
  name: 'Tema con fade',
  background: '#123456',
  animationSettings: '{"type":"fade","duration":0.6,"delay":0,"easing":"easeInOut"}',
  transitionSettings: '{"type":"fade","duration":0.6,"delay":0,"easing":"easeInOut"}'
} as never

const videoItem = {
  id: 'media-video-1',
  text: '',
  resourceType: 'MEDIA',
  name: 'Video',
  filePath: '/videos/demo.mp4',
  format: 'mp4',
  media: { id: 1, name: 'Video', type: 'VIDEO', filePath: '/videos/demo.mp4' }
} as never

const songItem = {
  id: 'song-1',
  text: 'Letra del cantico',
  resourceType: 'SONG'
} as never

const countThemeLayers = (container: HTMLElement) =>
  container.querySelectorAll(':scope > div > div.absolute.inset-0.w-full.h-full').length

const countSlideLayers = (container: HTMLElement) =>
  container.querySelectorAll('div.absolute.inset-0.overflow-hidden:not(.w-full)').length

describe('transicion cruzada de tema en live', () => {
  beforeEach(() => {
    window.liveMediaAPI = { onMediaState: vi.fn(() => vi.fn()) } as never
  })

  it('mantiene la capa saliente al pasar de un video a un tema (cross fade)', () => {
    const { container, rerender } = render(
      <PresentationView live items={[videoItem]} theme={fadeTheme} currentIndex={0} themeTransitionKey={0} />
    )

    expect(countThemeLayers(container)).toBe(1)
    expect(container.querySelector('video')).not.toBeNull()

    // Mismo `themeTransitionKey`: el tema aplicado no cambia, solo el item.
    rerender(
      <PresentationView live items={[songItem]} theme={fadeTheme} currentIndex={0} themeTransitionKey={0} />
    )

    // La capa del video sigue montada mientras entra la del tema.
    const layers = container.querySelectorAll(':scope > div > div.absolute.inset-0.w-full.h-full')
    expect(layers.length).toBe(2)

    // La saliente (video) va primero en el DOM, asi la entrante pinta encima y
    // el cross se resuelve sin pasar por el fondo negro.
    expect(layers[0].querySelector('video')).not.toBeNull()
    expect(layers[1].querySelector('video')).toBeNull()
  })

  it('mantiene la capa saliente al pasar de un tema a un video', () => {
    const { container, rerender } = render(
      <PresentationView live items={[songItem]} theme={fadeTheme} currentIndex={0} themeTransitionKey={0} />
    )

    expect(countThemeLayers(container)).toBe(1)

    rerender(
      <PresentationView live items={[videoItem]} theme={fadeTheme} currentIndex={0} themeTransitionKey={0} />
    )

    expect(countThemeLayers(container)).toBe(2)
  })

  it('cruza dos videos seguidos en la capa de slide, sin re-montar la de tema', () => {
    const secondVideoItem = { ...(videoItem as object), id: 'media-video-2' } as never

    const { container, rerender } = render(
      <PresentationView live items={[videoItem]} theme={fadeTheme} currentIndex={0} themeTransitionKey={0} />
    )

    rerender(
      <PresentationView
        live
        items={[secondVideoItem]}
        theme={fadeTheme}
        currentIndex={0}
        themeTransitionKey={0}
      />
    )

    // Ambos son MEDIA: misma firma de tema, asi que el cruce lo resuelve la
    // capa de slide (opaca, con su propio `bg-black` a sangre).
    expect(countThemeLayers(container)).toBe(1)
    expect(countSlideLayers(container)).toBe(2)
    expect(container.querySelectorAll('video').length).toBe(2)
  })

  it('no re-monta la capa de tema al navegar entre slides del mismo tema', () => {
    const secondSongItem = { ...(songItem as object), id: 'song-2', text: 'Segunda estrofa' } as never

    const { container, rerender } = render(
      <PresentationView
        live
        items={[songItem, secondSongItem]}
        theme={fadeTheme}
        currentIndex={0}
        themeTransitionKey={0}
      />
    )

    rerender(
      <PresentationView
        live
        items={[songItem, secondSongItem]}
        theme={fadeTheme}
        currentIndex={1}
        themeTransitionKey={0}
      />
    )

    expect(countThemeLayers(container)).toBe(1)
  })
})
