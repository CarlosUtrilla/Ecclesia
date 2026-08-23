import { cn } from '@/lib/utils'

/**
 * Px que se abren entre items cuando se arrastra algo sobre una zona de inserción.
 * Debe coincidir con el alto de una fila del cronograma (card + hueco del indicador):
 * al soltar, el hueco se cambia por el item recién insertado sin que nada se mueva.
 */
export const INSERTION_GAP = 44
/** Las cabeceras de grupo son algo más altas que un item normal. */
export const GROUP_INSERTION_GAP = 52
export const INSERTION_DURATION_MS = 300
export const INSERTION_EASING = 'cubic-bezier(0.2, 0, 0, 1)'

type Props = {
  visible: boolean
  /**
   * Anima la aparición/desaparición. Se desactiva al terminar el drag para que el
   * indicador no quede desvaneciéndose encima del item que se acaba de insertar.
   */
  animated?: boolean
  /** Color del grupo al que pertenece la zona, si aplica. */
  color?: string
}

/**
 * Hueco de altura fija con el indicador dibujado en `absolute`: el espacio real lo abren
 * los items siguientes con `transform` (ver `scheduleItem.tsx`), porque dnd-kit mide los
 * droppables ignorando transforms y así las zonas de detección no se mueven.
 */
export default function InsertionIndicator({ visible, animated = true, color }: Props) {
  return (
    <div className="relative w-full h-2.5">
      <div
        className={cn(
          'absolute inset-x-0 top-1 z-10 flex h-8 items-center justify-center rounded',
          'border-2 border-dashed border-primary bg-primary/20 pointer-events-none',
          animated && 'transition-all duration-300 ease-out',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
        style={{ background: color ? color + '33' : undefined }}
      >
        <span className="text-primary text-sm font-medium">Soltar para insertar aquí</span>
      </div>
    </div>
  )
}
