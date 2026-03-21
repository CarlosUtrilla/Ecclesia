// @vitest-environment jsdom

import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import usePresentationEditorShortcuts from './usePresentationEditorShortcuts'

type HarnessProps = {
  hasSelectedItem: boolean
  hasSelectedSlide: boolean
  preferSlideShortcuts: boolean
  onDelete: () => void
  onDeleteSlide: () => void
  onDuplicate: () => void
  onUndo: () => void
  onRedo: () => void
  onCopy?: () => void
  onPaste?: (event: ClipboardEvent) => void
}

function ShortcutsHarness(props: HarnessProps) {
  usePresentationEditorShortcuts(props)

  useEffect(() => {
    const editable = document.getElementById('editable')
    if (editable) editable.focus()
  }, [])

  return (
    <div>
      <div id="editable" contentEditable suppressContentEditableWarning>
        Texto editable de prueba
      </div>
      <input id="plain-input" defaultValue="valor" />
    </div>
  )
}

describe('usePresentationEditorShortcuts', () => {
  const baseCallbacks = {
    onDelete: vi.fn(),
    onDeleteSlide: vi.fn(),
    onDuplicate: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn()
  }

  it('deberia copiar item con Ctrl/Cmd+C cuando hay item seleccionado', () => {
    const onCopy = vi.fn()

    render(
      <ShortcutsHarness
        hasSelectedItem
        hasSelectedSlide
        preferSlideShortcuts={false}
        onCopy={onCopy}
        {...baseCallbacks}
      />
    )

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })

    window.dispatchEvent(event)

    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('no deberia copiar item si hay texto seleccionado en contenteditable', () => {
    const onCopy = vi.fn()

    render(
      <ShortcutsHarness
        hasSelectedItem
        hasSelectedSlide
        preferSlideShortcuts={false}
        onCopy={onCopy}
        {...baseCallbacks}
      />
    )

    const editable = document.getElementById('editable')
    if (!editable) throw new Error('editable no encontrado')

    const range = document.createRange()
    range.selectNodeContents(editable)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    editable.dispatchEvent(event)

    expect(onCopy).not.toHaveBeenCalled()
  })
})
