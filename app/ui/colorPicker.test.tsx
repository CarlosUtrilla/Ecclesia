// @vitest-environment jsdom

import * as ReactDOMClient from 'react-dom/client'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ColorPicker } from './colorPicker'

vi.mock('react-color', () => ({
  ChromePicker: ({ color }: { color: string }) => <div data-testid="chrome-picker">{color}</div>
}))

vi.mock('@/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

describe('ColorPicker', () => {
  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    delete (window as any).EyeDropper
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true
    })
  })

  it('deberia mostrar botón de cuentagotas cuando EyeDropper está disponible', async () => {
    class MockEyeDropper {
      async open() {
        return { sRGBHex: '#112233' }
      }
    }

    ;(window as any).EyeDropper = MockEyeDropper

    const handleChange = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = ReactDOMClient.createRoot(container)

    await act(async () => {
      root.render(<ColorPicker value="#000000" onChange={handleChange} />)
    })

    const eyeDropperButton = document.querySelector(
      'button[aria-label="Cuentagotas"]'
    ) as HTMLButtonElement | null

    if (!eyeDropperButton) throw new Error('No se encontro botón cuentagotas')
    await act(async () => {
      eyeDropperButton.click()
    })

    expect(handleChange).toHaveBeenCalledWith('#112233')

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('no deberia mostrar botón de cuentagotas cuando EyeDropper no está disponible', async () => {
    const handleChange = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = ReactDOMClient.createRoot(container)

    await act(async () => {
      root.render(<ColorPicker value="#000000" onChange={handleChange} />)
    })

    const eyeDropperButton = document.querySelector('button[aria-label="Cuentagotas"]')

    expect(eyeDropperButton).toBeNull()

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })
})
