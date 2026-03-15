// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AutoComplete, type Option } from './autocomplete'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe('AutoComplete', () => {
  it('muestra el label seleccionado cuando las opciones cargan después del mount', () => {
    const onValueChange = vi.fn()

    const { rerender } = render(
      <AutoComplete
        options={[]}
        value="Inter"
        onValueChange={onValueChange}
        emptyMessage="Sin resultados"
        placeholder="Buscar fuente..."
      />
    )

    const input = screen.getByPlaceholderText('Buscar fuente...') as HTMLInputElement
    expect(input.value).toBe('')

    const loadedOptions: Option[] = [
      { value: 'Inter', label: 'Inter' },
      { value: 'Poppins', label: 'Poppins' }
    ]

    rerender(
      <AutoComplete
        options={loadedOptions}
        value="Inter"
        onValueChange={onValueChange}
        emptyMessage="Sin resultados"
        placeholder="Buscar fuente..."
      />
    )

    expect(input.value).toBe('Inter')
  })

  it('al enfocar puede limpiar búsqueda para mostrar todas las opciones', async () => {
    const onValueChange = vi.fn()

    render(
      <AutoComplete
        options={[
          { value: 'Inter', label: 'Inter' },
          { value: 'Poppins', label: 'Poppins' }
        ]}
        showAllOnFocus
        value="Inter"
        onValueChange={onValueChange}
        emptyMessage="Sin resultados"
        placeholder="Buscar fuente..."
      />
    )

    const input = screen.getByPlaceholderText('Buscar fuente...') as HTMLInputElement
    expect(input.value).toBe('Inter')

    fireEvent.focus(input)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })
})
