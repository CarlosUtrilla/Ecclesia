import { useEffect } from 'react'

type Params = {
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

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true
  if (target.isContentEditable) return true
  return target.closest('[contenteditable="true"]') !== null
}

const shouldSkipItemCopyShortcut = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true

  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    const selectedText = window.getSelection()?.toString().trim() || ''
    return selectedText.length > 0
  }

  return false
}

export default function usePresentationEditorShortcuts({
  hasSelectedItem,
  hasSelectedSlide,
  preferSlideShortcuts,
  onDelete,
  onDeleteSlide,
  onDuplicate,
  onUndo,
  onRedo,
  onCopy,
  onPaste
}: Params) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        if (!hasSelectedItem || !onCopy || shouldSkipItemCopyShortcut(event.target)) return
        event.preventDefault()
        onCopy()
        return
      }

      if (isTypingTarget(event.target)) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (preferSlideShortcuts && hasSelectedSlide) {
          event.preventDefault()
          onDeleteSlide()
          return
        }

        if (!hasSelectedItem) return
        event.preventDefault()
        onDelete()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        if (!hasSelectedItem) return
        event.preventDefault()
        onDuplicate()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          onRedo()
          return
        }
        onUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    hasSelectedItem,
    hasSelectedSlide,
    preferSlideShortcuts,
    onDelete,
    onDeleteSlide,
    onDuplicate,
    onCopy,
    onRedo,
    onUndo
  ])

  useEffect(() => {
    if (!onPaste) return

    const handlePaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return
      onPaste(event)
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [onPaste])
}
