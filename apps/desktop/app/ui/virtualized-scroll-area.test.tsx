// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtualizedScrollArea } from './virtualized-scroll-area'

const items = ['Mateo', 'Lucas', 'Juan']

describe('VirtualizedScrollArea', () => {
  it('no deberia renderizar cabecera fija cuando no se pasa renderStickyHeader', () => {
    const { container } = render(
      <VirtualizedScrollArea
        items={items}
        renderItem={(item: string) => <div>{item}</div>}
        estimateSize={() => 40}
      />
    )

    expect(container.querySelector('.sticky')).toBeNull()
  })

  it('deberia renderizar la cabecera fija con el primer indice visible', () => {
    render(
      <VirtualizedScrollArea
        items={items}
        renderItem={(item: string) => <div>{item}</div>}
        estimateSize={() => 40}
        renderStickyHeader={(index) => <div>Seccion de {items[index]}</div>}
      />
    )

    expect(screen.getByText('Seccion de Mateo')).toBeTruthy()
  })

  it('deberia fijar la cabecera arriba sin ocupar alto en el flujo', () => {
    const { container } = render(
      <VirtualizedScrollArea
        items={items}
        renderItem={(item: string) => <div>{item}</div>}
        estimateSize={() => 40}
        renderStickyHeader={() => <div>cabecera</div>}
      />
    )

    const sticky = container.querySelector('.sticky')

    // h-0: la cabecera flota sobre las filas en vez de desplazarlas hacia abajo.
    expect(sticky?.className).toContain('top-0')
    expect(sticky?.className).toContain('h-0')
  })
})
