import { useEffect, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'

interface KeyboardShortcuts {
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onDelete?: () => void
  onSelectAll?: () => void
  onNavigate?: (
    direction: 'up' | 'down' | 'left' | 'right' | 'PageUp' | 'PageDown',
    extendSelection?: boolean
  ) => void
  onItemClick?: (item: any, event: React.MouseEvent) => void
  onClickOutside?: () => void
}

type RefType = React.RefObject<HTMLElement | null>
export function useKeyboardShortcuts(
  containerRef: RefType,
  shortcuts: KeyboardShortcuts,
  excludeRefs: RefType[] = []
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

  // Usar focusin/focusout para detectar foco en cualquier hijo
  useOnClickOutside(
    containerRef as any,
    () => {
      setContainerFocused(false)
      shortcuts.onClickOutside?.()
    },
    excludeRefs as any
  )

  // Click outside detection mejorada
  useEffect(() => {
    if (!shortcuts.onClickOutside) return
    function handleDocumentClick(e: MouseEvent) {
      const container = containerRef.current
      if (!container) return
      // Si el click fue dentro del contenedor, ignorar
      if (container.contains(e.target as Node)) return
      // Si el click fue dentro de algún ref excluido, ignorar
      for (const ref of excludeRefs) {
        if (ref.current && ref.current.contains(e.target as Node)) return
      }
      // Si no, es click outside
      shortcuts.onClickOutside?.()
    }
    document.addEventListener('mousedown', handleDocumentClick, true)
    return () => document.removeEventListener('mousedown', handleDocumentClick, true)
  }, [containerRef, excludeRefs, shortcuts])

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
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Si el foco está en un input, textarea o contenteditable, no interceptar Delete/Backspace
      const active = document.activeElement as HTMLElement | null
      const isTextInput =
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)

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
        if (!isTextInput) {
          e.preventDefault()
          shortcuts.onDelete()
          return
        }
      }

      // Navegación con flechas y AvPág/RePág (apuntadores de presentación)
      if (
        shortcuts.onNavigate &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)
      ) {
        e.preventDefault()
        const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
          PageUp: 'up',
          PageDown: 'down'
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
