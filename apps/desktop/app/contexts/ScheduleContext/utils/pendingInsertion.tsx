import { createContext, useContext } from 'react'

/**
 * Posición donde se acaba de soltar un item de la biblioteca y que todavía no aparece en
 * la lista: `form.setValue` de react-hook-form no entra en el mismo commit que el
 * `DragEnd` de dnd-kit, así que queda un frame con el drag terminado y el item sin
 * insertar. Mientras dure ese hueco temporal se mantiene abierto el espacio, para que los
 * items de abajo no suban 44px y vuelvan a bajar.
 */
export const PendingInsertionContext = createContext<number | null>(null)

export const usePendingInsertion = () => useContext(PendingInsertionContext)
