// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ScheduleItem } from '@ecclesia/api'
import { LiveProvider, useLive } from './liveContext'

const { onLiveStateUpdateCbRef, liveStateUpdateEmitMock, resetLiveStateMocks } = vi.hoisted(() => {
  let cb: ((payload: any) => void) | null = null
  const emitMock = vi.fn()
  return {
    onLiveStateUpdateCbRef: { get: () => cb, set: (v: typeof cb) => { cb = v } },
    liveStateUpdateEmitMock: emitMock,
    resetLiveStateMocks: () => { cb = null; emitMock.mockClear() }
  }
})

const getScheduleItemContentScreenMock = vi.fn().mockResolvedValue(null)
const setItemOnLiveMock = vi.fn()
const selectedThemeMock = {
  id: 1,
  name: 'Tema',
  background: '#000000',
  textStyle: {}
}
const displaysMock: never[] = []

vi.mock('..', () => ({
  useSchedule: () => ({
    getScheduleItemContentScreen: getScheduleItemContentScreenMock,
    itemOnLive: null,
    selectedTheme: selectedThemeMock,
    setItemOnLive: setItemOnLiveMock,
    getScheduleItemLabel: vi.fn().mockResolvedValue(''),
    currentSchedule: []
  })
}))

vi.mock('../../displayContext', () => ({
  useDisplays: () => ({
    displays: displaysMock,
    mainDisplay: null
  })
}))

vi.mock('@/hooks/useThemes', () => ({
  BlankTheme: { id: -1, name: 'Blank', background: '#ffffff', textStyle: {} },
  useThemes: () => ({
    themes: [
      { id: 1, name: 'Tema', background: '#000000', textStyle: {} },
      { id: 5, name: 'Oscuro', background: '#111111', textStyle: {} }
    ]
  })
}))

vi.mock('@ecclesia/queries', () => ({
  Api: {
    socket: {
      listen: {
        liveSendToItem: vi.fn().mockReturnValue(vi.fn()),
        liveClearItem: vi.fn().mockReturnValue(vi.fn()),
        liveNextSlide: vi.fn().mockReturnValue(vi.fn()),
        livePrevSlide: vi.fn().mockReturnValue(vi.fn()),
        liveGoToSlide: vi.fn().mockReturnValue(vi.fn()),
        liveSetHideText: vi.fn().mockReturnValue(vi.fn()),
        liveSetShowLogo: vi.fn().mockReturnValue(vi.fn()),
        liveSetBlackScreen: vi.fn().mockReturnValue(vi.fn()),
        liveStateUpdate: vi.fn((cb: any) => {
          onLiveStateUpdateCbRef.set(cb)
          return vi.fn()
        })
      },
      emit: {
        liveStateUpdate: vi.fn((...args: any[]) => liveStateUpdateEmitMock(...args))
      }
    }
  },
  onSocketReconnect: vi.fn().mockReturnValue(vi.fn())
}))

vi.mock('../../RemoteModeContext', () => ({
  useRemoteMode: () => ({ isRemoteMode: false })
}))

const ipcRendererOn = vi.fn().mockReturnValue(vi.fn())
const updateLiveScreenContent = vi.fn().mockResolvedValue(undefined)
const updateLiveScreenTheme = vi.fn().mockResolvedValue(undefined)

Object.assign(window, {
  electron: { ipcRenderer: { on: ipcRendererOn } },
  displayAPI: { updateLiveScreenContent, updateLiveScreenTheme }
})

describe('LiveContext', () => {
  const wrapper = ({ children }: PropsWithChildren) => <LiveProvider>{children}</LiveProvider>
  const createItem = (id: string): ScheduleItem => ({
    id,
    type: 'SONG',
    accessData: `texto-${id}`,
    deletedAt: null,
    order: 1,
    scheduleId: 1,
    updatedAt: new Date()
  })

  beforeEach(() => {
    resetLiveStateMocks()
  })

  it('deberia reiniciar itemIndex al mostrar un nuevo item sin indice explicito', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    act(() => {
      result.current.setItemIndex(2)
    })

    expect(result.current.itemIndex).toBe(2)

    await act(async () => {
      await result.current.showItemOnLiveScreen(createItem('item-1'))
    })

    await waitFor(() => {
      expect(result.current.itemIndex).toBe(0)
    })
  })

  it('deberia respetar el indice explicito al mostrar un item en vivo', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    await act(async () => {
      await result.current.showItemOnLiveScreen(createItem('item-2'), 1)
    })

    await waitFor(() => {
      expect(result.current.itemIndex).toBe(1)
    })
  })

  // --- Theme sync: liveStateUpdate broadcast payload ---

  it('deberia incluir themeId en el payload de liveStateUpdate cuando hay item en vivo', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    // Enviar item a live para que se active showLiveScreen
    await act(async () => {
      await result.current.showItemOnLiveScreen(createItem('item-theme'))
    })
    act(() => {
      result.current.setShowLiveScreen(true)
    })

    // Esperar a que el broadcast effect se ejecute
    await vi.waitFor(() => {
      expect(liveStateUpdateEmitMock).toHaveBeenCalled()
    })

    const lastCall = liveStateUpdateEmitMock.mock.calls.length - 1
    const payload = liveStateUpdateEmitMock.mock.calls[lastCall][0]
    expect(payload).toHaveProperty('themeId')
    expect(typeof payload.themeId).toBe('number')
  })

  it('deberia incluir themeId: null en el payload liveStateUpdate cuando no hay live activo', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    // Sin item en live y showLiveScreen=false → broadcast off-state
    act(() => {
      result.current.setShowLiveScreen(false)
    })

    await vi.waitFor(() => {
      expect(liveStateUpdateEmitMock).toHaveBeenCalled()
    })

    const payload = liveStateUpdateEmitMock.mock.calls[0][0]
    expect(payload.themeId).toBeNull()
  })

  // --- Remote theme override via liveStateUpdate handler ---

  it('deberia aplicar el tema remoto via liveStateUpdate cuando themeId coincide', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    await act(async () => {
      result.current.showItemOnLiveScreen(createItem('item-remote'))
    })

    // Verificar estado inicial: tema local aplicado
    expect(result.current.appliedTheme.id).toBe(selectedThemeMock.id) // id: 1

    // Simular liveStateUpdate desde un host remoto con themeId: 5 (Oscuro)
    const cb = onLiveStateUpdateCbRef.get()
    expect(cb).not.toBeNull()

    await act(async () => {
      cb!({
        itemOnLive: { id: 'item-remote', type: 'SONG', accessData: 'texto-item-remote' },
        itemIndex: 0,
        slideCount: 0,
        hideTextOnLive: false,
        showLogoOnLive: false,
        blackScreenOnLive: false,
        showLiveScreen: true,
        themeId: 5,
        liveScreens: [],
        stageScreens: []
      })
    })

    // El tema debe haberse actualizado al remoto
    expect(result.current.appliedTheme.id).toBe(5)
    expect(result.current.appliedTheme.name).toBe('Oscuro')
  })

  it('deberia mantener el tema local cuando themeId del remoto no existe en la lista', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    await act(async () => {
      result.current.showItemOnLiveScreen(createItem('item-remote'))
    })

    const cb = onLiveStateUpdateCbRef.get()
    await act(async () => {
      cb!({
        itemOnLive: { id: 'item-remote', type: 'SONG', accessData: 'texto-item-remote' },
        itemIndex: 0,
        slideCount: 0,
        hideTextOnLive: false,
        showLogoOnLive: false,
        blackScreenOnLive: false,
        showLiveScreen: true,
        themeId: 999,
        liveScreens: [],
        stageScreens: []
      })
    })

    // No hay tema con id: 999, debe mantener el local
    expect(result.current.appliedTheme.id).toBe(1)
  })

  it('deberia aplicar tema remoto tambien al limpiar item en vivo con themeId', async () => {
    const { result } = renderHook(() => useLive(), { wrapper })

    await act(async () => {
      result.current.showItemOnLiveScreen(createItem('item-clear'))
    })

    const cb = onLiveStateUpdateCbRef.get()
    await act(async () => {
      cb!({
        itemOnLive: null,
        itemIndex: 0,
        slideCount: 0,
        hideTextOnLive: false,
        showLogoOnLive: false,
        blackScreenOnLive: false,
        showLiveScreen: false,
        themeId: 5,
        liveScreens: [],
        stageScreens: []
      })
    })

    // El tema debe actualizarse incluso al limpiar live
    expect(result.current.appliedTheme.id).toBe(5)
    expect(result.current.itemOnLive).toBeNull()
  })
})
