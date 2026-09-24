/**
 * Contrato IPC del apuntador de presentación (AvPág/RePág).
 *
 * Vive en un archivo aparte porque lo consumen los tres lados: main, preload y
 * renderer, igual que `pptxRenderer/pptxRenderTypes.ts`.
 */

/** renderer → main: una ventana de Ecclesia recibió la tecla del apuntador. */
export const PRESENTER_REMOTE_KEY = 'presenter-remote:key'

/** renderer → main: hay (o no) algo en vivo que navegar. */
export const PRESENTER_REMOTE_SET_ENABLED = 'presenter-remote:set-enabled'

/** main → ventana principal: mover la diapositiva en vivo. */
export const PRESENTER_REMOTE_NAVIGATE = 'presenter-remote:navigate'

/** main → todas las ventanas: si el apuntador está armado (hay algo en vivo). */
export const PRESENTER_REMOTE_ENABLED = 'presenter-remote:enabled'

/** renderer → main (invoke): estado inicial para una ventana recién abierta. */
export const PRESENTER_REMOTE_GET_ENABLED = 'presenter-remote:get-enabled'

/** Aceleradores globales que se registran cuando Ecclesia no tiene el foco. */
export const PRESENTER_REMOTE_ACCELERATORS: Record<string, PresenterRemoteDirection> = {
  PageUp: 'prev',
  PageDown: 'next'
}

export type PresenterRemoteDirection = 'prev' | 'next'
