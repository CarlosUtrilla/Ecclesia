import { useEffect } from 'react'

type Params = {
  hasSelectedItem: boolean
  onDelete: () => void
  onDuplicate: () => void
  onUndo: () => void
  onRedo: () => void
}

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true
  if (target.isContentEditable) return true
  return target.closest('[contenteditable="true"]') !== null
}

export default function usePresentationEditorShortcuts({
  hasSelectedItem,
  onDelete,
  onDuplicate,
  onUndo,
  onRedo
}: Params) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if (event.key === 'Delete') {
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
  }, [hasSelectedItem, onDelete, onDuplicate, onRedo, onUndo])
}
