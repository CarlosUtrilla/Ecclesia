// @vitest-environment jsdom

import * as ReactDOMClient from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import SlideInsertSlot from './slideInsertSlot'

describe('SlideInsertSlot', () => {
  it('deberia ejecutar onInsert al hacer click', async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    const onInsert = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = ReactDOMClient.createRoot(container)

    await act(async () => {
      root.render(<SlideInsertSlot onInsert={onInsert} />)
    })

    const button = container.querySelector(
      'button[aria-label="Añadir diapositiva aquí"]'
    ) as HTMLButtonElement | null

    if (!button) throw new Error('No se encontró el botón de inserción')

    await act(async () => {
      button.click()
    })

    expect(onInsert).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
