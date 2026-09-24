import { useEffect, useRef } from 'react'

/**
 * Reenvía AvPág/RePág (las teclas que emiten los apuntadores de presentación)
 * al proceso principal, que las devuelve a la ventana principal como comando de
 * navegación en vivo.
 *
 * Se monta en todas las ventanas de la app, no en un panel: el apuntador debe
 * cambiar de diapositiva aunque el foco esté en la biblioteca, en un editor o
 * en una pantalla live. Cuando el foco está en otra aplicación no llega ningún
 * evento de DOM; de eso se encargan los aceleradores globales que registra
 * `electron/main/presenterRemote/presenterRemoteController.ts`.
 */

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.closest !== 'function') return false
  if (element.isContentEditable) return true
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
}

export function usePresenterRemoteKeys(): void {
  // Sin nada en vivo, la tecla no es del apuntador: debe seguir desplazando
  // listas y editores como siempre.
  const armedRef = useRef(false)

  useEffect(() => {
    const api = window.presenterRemoteAPI
    if (!api) return

    let disposed = false

    api.isEnabled().then((enabled) => {
      if (!disposed) armedRef.current = enabled
    })

    const offEnabledChange = api.onEnabledChange((enabled) => {
      armedRef.current = enabled
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!armedRef.current) return
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return
      // Un apuntador manda la tecla sola; con modificadores es el usuario
      // pidiendo otra cosa (mover un elemento, cambiar de pestaña...).
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      // Escribir sigue mandando: en un campo de texto AvPág/RePág desplazan el
      // cursor, no la diapositiva.
      if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return

      event.preventDefault()
      api.sendKey(event.key === 'PageUp' ? 'prev' : 'next')
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      disposed = true
      offEnabledChange()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
