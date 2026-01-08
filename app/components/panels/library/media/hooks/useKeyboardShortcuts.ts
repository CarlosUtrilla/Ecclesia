import { useEffect } from 'react'

interface KeyboardShortcuts {
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onDelete?: () => void
  onSelectAll?: () => void
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right', extendSelection?: boolean) => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Copiar (Ctrl/Cmd + C)
      if (cmdOrCtrl && e.key === 'c' && shortcuts.onCopy) {
        e.preventDefault()
        shortcuts.onCopy()
        return
      }

      // Cortar (Ctrl/Cmd + X)
      if (cmdOrCtrl && e.key === 'x' && shortcuts.onCut) {
        e.preventDefault()
        shortcuts.onCut()
        return
      }

      // Pegar (Ctrl/Cmd + V)
      if (cmdOrCtrl && e.key === 'v' && shortcuts.onPaste) {
        e.preventDefault()
        shortcuts.onPaste()
        return
      }

      // Seleccionar todo (Ctrl/Cmd + A)
      if (cmdOrCtrl && e.key === 'a' && shortcuts.onSelectAll) {
        e.preventDefault()
        shortcuts.onSelectAll()
        return
      }

      // Eliminar (Delete o Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && shortcuts.onDelete) {
        e.preventDefault()
        shortcuts.onDelete()
        return
      }

      // Navegación con flechas (con soporte para Shift+Flecha)
      if (
        shortcuts.onNavigate &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault()
        const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right'
        }
        // Pasar si Shift está presionado para extender la selección
        shortcuts.onNavigate(directionMap[e.key], e.shiftKey)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
