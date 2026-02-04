import { useEffect, useState } from 'react'

interface KeyboardShortcuts {
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onDelete?: () => void
  onSelectAll?: () => void
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right', extendSelection?: boolean) => void
  onItemClick?: (item: any, event: React.MouseEvent) => void
  onClickOutside?: () => void
}

export function useKeyboardShortcuts(
  containerRef: React.RefObject<HTMLElement | null>,
  shortcuts: KeyboardShortcuts
) {
  const [containerFocused, setContainerFocused] = useState(false)

  // Función helper para manejar clicks con modificadores
  const handleItemClick = (item: any, event: React.MouseEvent) => {
    // Focus en el contenedor para habilitar atajos de teclado
    containerRef.current?.focus()

    if (shortcuts.onItemClick) {
      shortcuts.onItemClick(item, event)
    }
  }

  useEffect(() => {
    const handleBlur = () => {
      setContainerFocused(false)
      if (shortcuts.onClickOutside) {
        shortcuts.onClickOutside()
      }
    }
    const current = containerRef.current
    if (current) {
      current.addEventListener('blur', handleBlur)
    }
    return () => {
      if (current) {
        current.removeEventListener('blur', handleBlur)
      }
    }
  }, [containerRef])

  useEffect(() => {
    const handleFocus = () => setContainerFocused(true)
    const current = containerRef.current
    if (current) {
      // Configurar automáticamente tabIndex para que pueda recibir focus
      if (!current.hasAttribute('tabindex')) {
        current.tabIndex = 0
      }
      // Añadir outline-none para mejor UX
      if (!current.style.outline) {
        current.style.outline = 'none'
      }

      current.addEventListener('focus', handleFocus)
    }
    return () => {
      if (current) {
        current.removeEventListener('focus', handleFocus)
      }
    }
  }, [containerRef])

  useEffect(() => {
    if (!containerFocused) {
      console.log('Container not focused, skipping keyboard shortcuts')
      return
    }
    console.log('Container focused, enabling keyboard shortcuts')
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
  }, [shortcuts, containerFocused])

  const handleSetContainerRef = (element: HTMLElement | null) => {
    containerRef.current = element
  }
  // Retornar la función de click para que el componente la use
  return {
    handleItemClick,
    setContainerRef: handleSetContainerRef
  }
}
