// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ScheduleItem } from '@ecclesia/api'
import { LiveProvider, useLive } from './liveContext'

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
    setItemOnLive: setItemOnLiveMock
  })
}))

vi.mock('../../displayContext', () => ({
  useDisplays: () => ({
    displays: displaysMock,
    mainDisplay: null
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
        liveStateUpdate: vi.fn().mockReturnValue(vi.fn())
      },
      emit: {
        liveStateUpdate: vi.fn()
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
})
