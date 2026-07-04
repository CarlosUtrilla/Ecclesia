// @vitest-environment jsdom

import { act, render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { PropsWithChildren } from 'react'
import { ScheduleProvider, useSchedule } from '.'

// --- Hoisted mocks (necesario porque vi.mock se hoistea al tope del archivo) ---
const { scheduleStateUpdateListenMock, scheduleStateUpdateEmitMock, onSocketReconnectMock } =
  vi.hoisted(() => ({
    scheduleStateUpdateListenMock: vi.fn(),
    scheduleStateUpdateEmitMock: vi.fn(),
    onSocketReconnectMock: vi.fn()
  }))

let onScheduleStateUpdateCb: ((payload: any) => void) | null = null
let onReconnectCb: (() => void) | null = null

// Refrescar los callbacks cada vez que se llame al mock
scheduleStateUpdateListenMock.mockImplementation((cb: any) => {
  onScheduleStateUpdateCb = cb
  return vi.fn()
})
onSocketReconnectMock.mockImplementation((cb: () => void) => {
  onReconnectCb = cb
  return vi.fn()
})

vi.mock('@/hooks/useThemes', () => ({
  BlankTheme: { id: -1, name: 'Blank', background: '#ffffff', textStyle: '{}' },
  useThemes: () => ({ themes: [] })
}))

vi.mock('@ecclesia/queries', () => ({
  Api: {
    socket: {
      listen: {
        scheduleStateUpdate: scheduleStateUpdateListenMock
      },
      emit: {
        scheduleStateUpdate: scheduleStateUpdateEmitMock
      }
    },
    fetch: {
      schedule: {
        getActualSchedule: vi.fn().mockResolvedValue(null)
      }
    },
    query: {
      settings: {
        getSettings: vi.fn().mockReturnValue({ queryKey: ['settings'] })
      }
    }
  },
  onSocketReconnect: onSocketReconnectMock
}))

vi.mock('./utils/indexDataItems', () => ({
  useIndexDataItems: () => ({
    getScheduleItemIcon: vi.fn(),
    getScheduleItemLabel: vi.fn().mockResolvedValue(''),
    getScheduleItemContentScreen: vi.fn().mockResolvedValue({ title: '', content: [] }),
    songs: [],
    media: []
  })
}))

vi.mock('./utils/liveContext', () => ({
  LiveProvider: ({ children }: PropsWithChildren) => <>{children}</>
}))

vi.mock('./utils/dragAndDropSchedule', () => ({
  default: ({ children }: PropsWithChildren) => <>{children}</>
}))

let uniqueIdCounter = 0
vi.mock('@/lib/utils', () => ({
  generateUniqueId: () => `test-id-${++uniqueIdCounter}`
}))

// Mock window.electron for IPC
Object.assign(window, {
  electron: { ipcRenderer: { on: vi.fn().mockReturnValue(vi.fn()) } },
  displayAPI: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
})

// --- Helpers ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <ScheduleProvider>{children}</ScheduleProvider>
    </QueryClientProvider>
  )
}

function createRemotePayload(overrides: Record<string, any> = {}) {
  return {
    id: null,
    title: 'Remote Schedule',
    items: [
      {
        id: 'remote-item-1',
        order: 1,
        type: 'SONG',
        accessData: '42',
        scheduleId: -1,
        updatedAt: new Date().toISOString(),
        deletedAt: null
      }
    ],
    dateFrom: null,
    dateTo: null,
    isTemporary: false,
    ...overrides
  }
}

describe('ScheduleProvider', () => {
  beforeEach(() => {
    uniqueIdCounter = 0
    onScheduleStateUpdateCb = null
    onReconnectCb = null
    scheduleStateUpdateListenMock.mockClear()
    scheduleStateUpdateEmitMock.mockClear()
    onSocketReconnectMock.mockClear()
  })

  // --- TDZ regression ---

  it('no debería lanzar TDZ (ReferenceError) al renderizar', () => {
    expect(() =>
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ScheduleProvider>
            <div>test</div>
          </ScheduleProvider>
        </QueryClientProvider>
      )
    ).not.toThrow()
  })

  it('debería renderizar sus hijos', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ScheduleProvider>
          <div>child-content</div>
        </ScheduleProvider>
      </QueryClientProvider>
    )
    expect(screen.getByText('child-content')).toBeDefined()
  })

  // --- Socket.IO registration ---

  it('debería registrar listener de scheduleStateUpdate al montar', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ScheduleProvider>
          <div />
        </ScheduleProvider>
      </QueryClientProvider>
    )
    expect(scheduleStateUpdateListenMock).toHaveBeenCalledTimes(1)
    expect(onSocketReconnectMock).toHaveBeenCalledTimes(1)
  })

  // --- Remote sync: scheduleStateUpdate ---

  it('debería recibir items desde un cliente remoto vía scheduleStateUpdate', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    expect(result.current.currentSchedule).toHaveLength(0)
    expect(result.current.isTemporary).toBe(true)

    act(() => {
      onScheduleStateUpdateCb!(createRemotePayload())
    })

    expect(result.current.currentSchedule).toHaveLength(1)
    expect(result.current.currentSchedule[0].id).toBe('remote-item-1')
    expect(result.current.currentSchedule[0].type).toBe('SONG')
    expect(result.current.currentSchedule[0].accessData).toBe('42')
    expect(result.current.isTemporary).toBe(false)
  })

  it('debería actualizar título desde scheduleStateUpdate remoto', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      onScheduleStateUpdateCb!(createRemotePayload({ title: 'Culto Joven' }))
    })

    expect(result.current.form.getValues('title')).toBe('Culto Joven')
  })

  it('debería reemplazar items completamente al recibir scheduleStateUpdate (no merge)', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    // Primer payload con 1 item
    act(() => {
      onScheduleStateUpdateCb!(createRemotePayload())
    })
    expect(result.current.currentSchedule).toHaveLength(1)

    // Segundo payload con 2 items diferentes (sin merge)
    act(() => {
      onScheduleStateUpdateCb!(
        createRemotePayload({
          items: [
            {
              id: 'remote-item-a',
              order: 1,
              type: 'BIBLE',
              accessData: '1-1-1',
              scheduleId: -1,
              updatedAt: new Date().toISOString(),
              deletedAt: null
            },
            {
              id: 'remote-item-b',
              order: 2,
              type: 'MEDIA',
              accessData: '7',
              scheduleId: -1,
              updatedAt: new Date().toISOString(),
              deletedAt: null
            }
          ]
        })
      )
    })

    expect(result.current.currentSchedule).toHaveLength(2)
    expect(result.current.currentSchedule[0].type).toBe('BIBLE')
    expect(result.current.currentSchedule[1].type).toBe('MEDIA')
    // El item anterior ya no está
    expect(result.current.currentSchedule.find((i: any) => i.id === 'remote-item-1')).toBeUndefined()
  })

  // --- Local addItemToSchedule ---

  it('debería agregar un item localmente con addItemToSchedule', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      result.current.addItemToSchedule({ type: 'SONG', accessData: 99 })
    })

    expect(result.current.currentSchedule).toHaveLength(1)
    expect(result.current.currentSchedule[0].type).toBe('SONG')
    expect(result.current.currentSchedule[0].accessData).toBe('99')
    expect(result.current.currentSchedule[0].order).toBe(1)
  })

  it('debería emitir scheduleStateUpdate al agregar item localmente', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      result.current.addItemToSchedule({ type: 'SONG', accessData: 99 })
    })

    expect(scheduleStateUpdateEmitMock).toHaveBeenCalledTimes(1)
    const payload = scheduleStateUpdateEmitMock.mock.calls[0][0]
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].type).toBe('SONG')
    expect(payload.isTemporary).toBe(true)
  })

  it('debería insertar item en posición específica con insertPosition', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 1 }) })
    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 2 }) })
    // Insertar en medio (posición 1)
    act(() => { result.current.addItemToSchedule({ type: 'BIBLE', accessData: '1-1-1', insertPosition: 1 }) })

    expect(result.current.currentSchedule).toHaveLength(3)
    expect(result.current.currentSchedule[0].accessData).toBe('1')
    expect(result.current.currentSchedule[1].accessData).toBe('1-1-1')
    expect(result.current.currentSchedule[2].accessData).toBe('2')
  })

  it('no debería agregar items con tipo inválido', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      ;(result.current.addItemToSchedule as any)({ type: 'INVALID', accessData: 1 })
    })

    expect(result.current.currentSchedule).toHaveLength(0)
    expect(scheduleStateUpdateEmitMock).not.toHaveBeenCalled()
  })

  // --- Local deleteItemFromSchedule ---

  it('debería eliminar un item localmente con deleteItemFromSchedule', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 1 }) })
    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 2 }) })
    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 3 }) })
    expect(result.current.currentSchedule).toHaveLength(3)

    act(() => { result.current.deleteItemFromSchedule(1) })

    expect(result.current.currentSchedule).toHaveLength(2)
    expect(result.current.currentSchedule[0].accessData).toBe('1')
    expect(result.current.currentSchedule[1].accessData).toBe('3')
    expect(result.current.currentSchedule[0].order).toBe(1)
    expect(result.current.currentSchedule[1].order).toBe(2)
  })

  it('debería emitir scheduleStateUpdate al eliminar item', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      result.current.addItemToSchedule({ type: 'SONG', accessData: 1 })
    })
    scheduleStateUpdateEmitMock.mockClear()

    act(() => {
      result.current.deleteItemFromSchedule(0)
    })

    expect(scheduleStateUpdateEmitMock).toHaveBeenCalledTimes(1)
    const payload = scheduleStateUpdateEmitMock.mock.calls[0][0]
    expect(payload.items).toHaveLength(0)
  })

  // --- Reordenamiento local ---

  it('debería reordenar items con reorderItems', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 'a' }) })
    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 'b' }) })
    act(() => { result.current.addItemToSchedule({ type: 'SONG', accessData: 'c' }) })

    const items = result.current.currentSchedule
    act(() => {
      result.current.reorderItems(items[2].id, items[0].id) // mover c al inicio
    })

    expect(result.current.currentSchedule[0].accessData).toBe('c')
    expect(result.current.currentSchedule[1].accessData).toBe('a')
    expect(result.current.currentSchedule[2].accessData).toBe('b')
    expect(result.current.currentSchedule.map((i: any) => i.order)).toEqual([1, 2, 3])
  })

  // --- Ciclo completo: remoto → local sync ---

  it('debería sincronizar estado: item agregado por remoto visible después de addItemToSchedule local', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    // Remoto agrega un item
    act(() => {
      onScheduleStateUpdateCb!(createRemotePayload())
    })

    // Luego local agrega otro
    act(() => {
      result.current.addItemToSchedule({ type: 'MEDIA', accessData: 7 })
    })

    // Ambos deben estar presentes
    expect(result.current.currentSchedule).toHaveLength(2)
    expect(result.current.currentSchedule.find((i: any) => i.id === 'remote-item-1')).toBeDefined()
    expect(result.current.currentSchedule.find((i: any) => i.accessData === '7')).toBeDefined()
  })

  // --- createTemporarySchedule ---

  it('debería crear schedule temporal vacío', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSchedule(), { wrapper })

    act(() => {
      result.current.addItemToSchedule({ type: 'SONG', accessData: 1 })
    })
    expect(result.current.currentSchedule).toHaveLength(1)

    act(() => {
      result.current.createTemporarySchedule()
    })

    expect(result.current.currentSchedule).toHaveLength(0)
    expect(result.current.isTemporary).toBe(true)
    expect(result.current.form.getValues('title')).toBe('')
  })

  // --- Reconnection rebinds listener ---

  it('debería re-registrar listener de scheduleStateUpdate al reconectar', () => {
    const wrapper = createWrapper()
    renderHook(() => useSchedule(), { wrapper })

    expect(scheduleStateUpdateListenMock).toHaveBeenCalledTimes(1)

    // Simular reconexión Socket.IO
    act(() => {
      onReconnectCb!()
    })

    // Pequeño delay para que React procese el efecto
    act(() => {})

    // El listener se registró de nuevo (total 2 veces)
    expect(scheduleStateUpdateListenMock).toHaveBeenCalledTimes(2)
  })
})
