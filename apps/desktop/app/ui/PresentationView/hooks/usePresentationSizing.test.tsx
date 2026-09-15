// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePresentationSizing } from './usePresentationSizing'

vi.mock('@/contexts/ScreenSizeContext', () => ({
  useScreenSize: (maxHeight: number) => ({
    width: Math.round((maxHeight * 16) / 9),
    height: maxHeight,
    aspectRatio: '16 / 9'
  })
}))

type ObserverRecord = {
  target: Element
  emit: (blockSize: number) => void
  disconnected: boolean
}

const observers: ObserverRecord[] = []

class FakeResizeObserver {
  private record: ObserverRecord | null = null

  constructor(private callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.record = {
      target,
      disconnected: false,
      emit: (blockSize: number) => {
        this.callback(
          [{ target, borderBoxSize: [{ blockSize, inlineSize: 0 }] } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver
        )
      }
    }
    observers.push(this.record)
  }

  disconnect() {
    if (this.record) this.record.disconnected = true
  }

  unobserve() {}
}

function emitLastObserver(blockSize: number) {
  const active = observers.filter((observer) => !observer.disconnected)
  act(() => {
    active[active.length - 1]?.emit(blockSize)
  })
}

type HarnessProps = {
  renderNode: boolean
  onHeight: (height: number) => void
}

function Harness({ renderNode, onHeight }: HarnessProps) {
  const { containerRef, effectiveHeight } = usePresentationSizing({})
  onHeight(effectiveHeight)
  return renderNode ? <div ref={containerRef} /> : null
}

/** Reproduce PresentationView: al arrancar no hay items, asi que no hay nodo que medir. */
function DeferredHarness({ onHeight }: { onHeight: (height: number) => void }) {
  const [hasNode, setHasNode] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setHasNode(true)}>
        montar
      </button>
      <Harness renderNode={hasNode} onHeight={onHeight} />
    </>
  )
}

describe('usePresentationSizing', () => {
  beforeEach(() => {
    observers.length = 0
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mide el contenedor cuando se monta en un commit posterior al primero', () => {
    const heights: number[] = []
    const { getByText } = render(<DeferredHarness onHeight={(height) => heights.push(height)} />)

    expect(observers).toHaveLength(0)
    expect(heights.at(-1)).toBe(0)

    act(() => {
      getByText('montar').click()
    })

    expect(observers).toHaveLength(1)

    emitLastObserver(1080)

    expect(heights.at(-1)).toBe(1080)
  })

  it('conserva la ultima medida buena cuando el contenedor reporta alto 0', () => {
    const heights: number[] = []
    render(<Harness renderNode onHeight={(height) => heights.push(height)} />)

    emitLastObserver(1080)
    expect(heights.at(-1)).toBe(1080)

    emitLastObserver(0)
    expect(heights.at(-1)).toBe(1080)
  })

  it('usa el border box y no el rect transformado por la animacion de entrada', () => {
    const heights: number[] = []
    const { container } = render(<Harness renderNode onHeight={(height) => heights.push(height)} />)

    const node = container.querySelector('div') as HTMLDivElement
    // Durante un `zoomIn` el rect devuelve el alto ya escalado.
    node.getBoundingClientRect = () => ({ height: 540, width: 960 }) as DOMRect

    emitLastObserver(1080)

    expect(heights.at(-1)).toBe(1080)
  })

  it('vuelve a observar el nodo nuevo cuando el contenedor se remonta', () => {
    const heights: number[] = []
    const { rerender } = render(<Harness renderNode onHeight={(height) => heights.push(height)} />)

    emitLastObserver(1080)
    expect(heights.at(-1)).toBe(1080)

    rerender(<Harness renderNode={false} onHeight={(height) => heights.push(height)} />)
    expect(observers[0].disconnected).toBe(true)

    rerender(<Harness renderNode onHeight={(height) => heights.push(height)} />)
    emitLastObserver(720)

    expect(heights.at(-1)).toBe(720)
  })
})
