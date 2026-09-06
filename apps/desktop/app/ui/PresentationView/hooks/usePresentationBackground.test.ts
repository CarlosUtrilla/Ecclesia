// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePresentationBackground } from './usePresentationBackground'
import { ThemeWithMedia } from '../types'

const buildMediaUrl = (path: string) => `http://media/${path}`

const imageTheme = {
  id: 1,
  background: 'media',
  backgroundMedia: { id: 10, type: 'IMAGE', filePath: 'fondo.jpg' }
} as unknown as ThemeWithMedia

const videoTheme = {
  id: 2,
  background: 'media',
  backgroundMedia: {
    id: 11,
    type: 'VIDEO',
    filePath: 'clip.mp4',
    thumbnail: 'clip.jpg',
    fallback: 'clip-fallback.jpg'
  }
} as unknown as ThemeWithMedia

const otherVideoTheme = {
  id: 3,
  background: 'media',
  backgroundMedia: { id: 12, type: 'VIDEO', filePath: 'otro.mp4' }
} as unknown as ThemeWithMedia

describe('usePresentationBackground', () => {
  it('resuelve el fondo en el primer render, sin pasar por un frame vacio', () => {
    // Resolviendolo por efecto, la capa entrante de una transicion de tema salia
    // un frame con backgroundType 'color' y sin URL, pintando el color del frame
    // (negro en modo oscuro) en mitad del cross.
    const { result } = renderHook(() => usePresentationBackground({ theme: imageTheme, buildMediaUrl }))

    expect(result.current.backgroundType).toBe('image')
    expect(result.current.backgroundUrl).toBe('http://media/fondo.jpg')
  })

  it('resuelve thumbnail y fallback de video en el primer render', () => {
    const { result } = renderHook(() => usePresentationBackground({ theme: videoTheme, buildMediaUrl }))

    expect(result.current.backgroundType).toBe('video')
    expect(result.current.backgroundUrl).toBe('http://media/clip.mp4')
    expect(result.current.thumbnailUrl).toBe('http://media/clip.jpg')
    expect(result.current.fallbackUrl).toBe('http://media/clip-fallback.jpg')
    expect(result.current.videoLoaded).toBe(false)
  })

  it('descarta el videoLoaded del fondo anterior en el mismo render que cambia la URL', () => {
    const { result, rerender } = renderHook(
      ({ theme }) => usePresentationBackground({ theme, buildMediaUrl }),
      { initialProps: { theme: videoTheme } }
    )

    act(() => result.current.setVideoLoaded(true))
    expect(result.current.videoLoaded).toBe(true)

    rerender({ theme: otherVideoTheme })

    // Sin efecto de reset de por medio: el flag es falso ya en este render.
    expect(result.current.videoLoaded).toBe(false)
    expect(result.current.backgroundUrl).toBe('http://media/otro.mp4')
  })

  it('no marca como cargado un fondo que no es video', () => {
    const { result, rerender } = renderHook(
      ({ theme }) => usePresentationBackground({ theme, buildMediaUrl }),
      { initialProps: { theme: videoTheme } }
    )

    act(() => result.current.setVideoLoaded(true))
    rerender({ theme: imageTheme })

    expect(result.current.videoLoaded).toBe(false)
    expect(result.current.videoError).toBe(false)
  })

  it('trata color y gradiente como fondos solidos', () => {
    const color = { id: 4, background: '#112233' } as unknown as ThemeWithMedia
    const gradient = {
      id: 5,
      background: 'linear-gradient(#000, #fff)'
    } as unknown as ThemeWithMedia

    expect(
      renderHook(() => usePresentationBackground({ theme: color, buildMediaUrl })).result.current
        .backgroundType
    ).toBe('color')

    expect(
      renderHook(() => usePresentationBackground({ theme: gradient, buildMediaUrl })).result.current
        .backgroundType
    ).toBe('gradient')
  })

  it('cae a color cuando el tema apunta a media pero no hay filePath', () => {
    const broken = {
      id: 6,
      background: 'media',
      backgroundMedia: { id: 13, type: 'IMAGE' }
    } as unknown as ThemeWithMedia

    const { result } = renderHook(() => usePresentationBackground({ theme: broken, buildMediaUrl }))

    expect(result.current.backgroundType).toBe('color')
  })
})
