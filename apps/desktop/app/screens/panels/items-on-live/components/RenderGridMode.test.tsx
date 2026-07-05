// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RenderGridMode from './RenderGridMode'
import type { PresentationViewItems, ThemeWithMedia } from '@/ui/PresentationView/types'

const setItemIndexMock = vi.fn()
const appliedThemeMock = { id: 1, name: 'Tema', background: '#000000', textStyle: {} } as ThemeWithMedia

vi.mock('@/contexts/ScheduleContext/utils/liveContext', () => ({
  useLive: () => ({
    itemIndex: 0,
    setItemIndex: setItemIndexMock,
    appliedTheme: appliedThemeMock
  })
}))

vi.mock('@/ui/PresentationView', () => ({
  PresentationView: ({ selected }: { selected?: boolean }) => (
    <div data-testid={selected ? 'pv-selected' : 'pv-not-selected'} />
  )
}))

const baseItems = [
  { type: 'text' as const, value: 'Slide 1' },
  { type: 'text' as const, value: 'Slide 2' },
  { type: 'text' as const, value: 'Slide 3' }
] as PresentationViewItems[]

describe('RenderGridMode', () => {
  beforeEach(() => {
    setItemIndexMock.mockClear()
  })

  it('deberia llamar setItemIndex con el indice del item clickeado', () => {
    render(<RenderGridMode data={baseItems} />)

    const items = document.querySelectorAll<HTMLElement>('[data-grid-index]')
    expect(items).toHaveLength(3)

    fireEvent.click(items[1])
    expect(setItemIndexMock).toHaveBeenCalledWith(1)
  })

  it('deberia mapear el indice via indexMap antes de llamar setItemIndex', () => {
    render(<RenderGridMode data={baseItems} indexMap={[2, 0, 1]} />)

    const items = document.querySelectorAll<HTMLElement>('[data-grid-index]')
    fireEvent.click(items[0])
    expect(setItemIndexMock).toHaveBeenCalledWith(2)

    fireEvent.click(items[1])
    expect(setItemIndexMock).toHaveBeenCalledWith(0)

    fireEvent.click(items[2])
    expect(setItemIndexMock).toHaveBeenCalledWith(1)
  })

  it('deberia llamar onSelectIndexOverride en lugar de setItemIndex cuando se proporciona', () => {
    const onSelect = vi.fn()
    render(<RenderGridMode data={baseItems} onSelectIndexOverride={onSelect} />)

    const items = document.querySelectorAll<HTMLElement>('[data-grid-index]')
    fireEvent.click(items[2])
    expect(onSelect).toHaveBeenCalledWith(2)
    expect(setItemIndexMock).not.toHaveBeenCalled()
  })

  it('deberia respetar activeIndexOverride para marcar el item seleccionado', () => {
    render(<RenderGridMode data={baseItems} activeIndexOverride={1} />)

    const selected = screen.getAllByTestId('pv-selected')
    expect(selected).toHaveLength(1)

    const notSelected = screen.getAllByTestId('pv-not-selected')
    expect(notSelected).toHaveLength(2)
  })

  it('deberia usar itemIndex de useLive cuando no hay activeIndexOverride', () => {
    render(<RenderGridMode data={baseItems} />)

    // itemIndex mockeado es 0
    const selected = screen.getAllByTestId('pv-selected')
    expect(selected).toHaveLength(1)
  })

  it('deberia renderizar preview badges cuando se proporcionan', () => {
    render(<RenderGridMode data={baseItems} previewBadgeByIndex={['1/3', null, '3/3']} />)

    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.queryByText('2/3')).not.toBeInTheDocument()
  })

  it('deberia pasar themeOverride cuando se proporciona', () => {
    const themeOverride = { id: 99, name: 'Override', background: '#ff0000' } as ThemeWithMedia
    render(<RenderGridMode data={baseItems} themeOverride={themeOverride} />)

    // No assertion on theme; just verifying no crash
    const items = document.querySelectorAll<HTMLElement>('[data-grid-index]')
    expect(items).toHaveLength(3)
  })
})
