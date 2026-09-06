// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveScreen from '.'

// `liveScreen-update` y `liveScreen-update-theme` llegan en mensajes IPC
// separados. Si se aplicaran en renders distintos, el contenido nuevo
// reemplazaria al viejo antes de que la capa de tema se re-montara y la
// transicion cruzada animaria el mismo contenido contra si mismo.

const ipcHandlers = new Map<string, (event: unknown, data: unknown) => void>()
const presentationRenderSpy = vi.fn()

vi.mock('react-router', () => ({
  useParams: () => ({ displayId: undefined })
}))

vi.mock('@/contexts/MediaServerContext', () => ({
  useMediaServer: () => ({ buildMediaUrl: (path: string) => path })
}))

vi.mock('../../ui/PresentationView', () => ({
  PresentationView: (props: Record<string, unknown>) => {
    presentationRenderSpy(props)
    return <div data-testid="presentation-view" />
  }
}))

vi.mock('@ecclesia/queries', () => ({
  Api: {
    fetch: {
      settings: { getSettings: vi.fn().mockResolvedValue([]) },
      media: { getMediaByIds: vi.fn().mockResolvedValue([]) }
    }
  }
}))

const themeA = { id: 1, name: 'Tema A', background: '#111111' }
const themeB = { id: 2, name: 'Tema B', background: '#222222' }
const contentA = { content: [{ id: 'song-1', text: 'A', resourceType: 'SONG' }] }
const contentB = { content: [{ id: 'song-2', text: 'B', resourceType: 'SONG' }] }

describe('LiveScreen: agrupado de actualizaciones IPC', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ipcHandlers.clear()
    presentationRenderSpy.mockClear()
    window.electron = {
      ipcRenderer: {
        send: vi.fn(),
        on: (channel: string, handler: (event: unknown, data: unknown) => void) => {
          ipcHandlers.set(channel, handler)
          return () => ipcHandlers.delete(channel)
        }
      }
    } as never
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const flushPending = () => {
    act(() => {
      vi.advanceTimersByTime(100)
    })
  }

  it('aplica contenido y tema en un unico render', () => {
    render(<LiveScreen isPreview />)

    // Dos `act` distintos: cada mensaje IPC llega en su propia tarea, asi que
    // React no los agrupa por si mismo.
    act(() => {
      ipcHandlers.get('liveScreen-update')?.(null, { itemIndex: 0, contentScreen: contentA })
    })
    act(() => {
      ipcHandlers.get('liveScreen-update-theme')?.(null, themeA)
    })

    presentationRenderSpy.mockClear()
    flushPending()

    const renders = presentationRenderSpy.mock.calls.map(([props]) => props)
    expect(renders.length).toBeGreaterThan(0)

    // Ningun render intermedio con el contenido nuevo y el tema por defecto.
    for (const props of renders) {
      expect(props.items).toEqual(contentA.content)
      expect(props.theme).toBe(themeA)
    }
  })

  it('incrementa themeTransitionKey una sola vez por cambio visual de tema', () => {
    render(<LiveScreen isPreview />)

    act(() => {
      ipcHandlers.get('liveScreen-update')?.(null, { itemIndex: 0, contentScreen: contentA })
    })
    act(() => {
      ipcHandlers.get('liveScreen-update-theme')?.(null, themeA)
    })
    flushPending()

    const keyAfterFirst = presentationRenderSpy.mock.calls.at(-1)?.[0].themeTransitionKey

    // Reenviar el mismo tema (otro objeto) no debe re-disparar la transicion.
    act(() => {
      ipcHandlers.get('liveScreen-update-theme')?.(null, { ...themeA })
    })
    flushPending()

    expect(presentationRenderSpy.mock.calls.at(-1)?.[0].themeTransitionKey).toBe(keyAfterFirst)

    act(() => {
      ipcHandlers.get('liveScreen-update')?.(null, { itemIndex: 0, contentScreen: contentB })
    })
    act(() => {
      ipcHandlers.get('liveScreen-update-theme')?.(null, themeB)
    })
    flushPending()

    const lastProps = presentationRenderSpy.mock.calls.at(-1)?.[0]
    expect(lastProps.themeTransitionKey).toBe((keyAfterFirst as number) + 1)
    expect(lastProps.items).toEqual(contentB.content)
    expect(lastProps.theme).toBe(themeB)
  })
})
