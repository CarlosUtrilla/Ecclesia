import { type Variants } from 'framer-motion'
import { AnimationSettings } from '@/lib/animationSettings'
import { AnimationType } from '@/lib/animations'

/**
 * Tipos cuya transicion se resuelve por transform: las dos capas se desplazan
 * en bloque y siempre opacas, asi que no hay hueco por el que se vea el fondo.
 */
const TRANSFORM_TRANSITION_TYPES = [
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'zoomIn',
  'zoomOut',
  'scale'
]

// La capa saliente se mantiene opaca casi toda la transicion y solo cae a 0 en
// el ultimo tramo, cuando la entrante ya la cubre por completo. Se necesita un
// valor que cambie de verdad para que framer-motion respete la duracion del
// `exit`; con `opacity: 1` fijo desmontaria la capa al instante.
const HOLD_KEYFRAMES = [1, 1, 0]
const HOLD_TIMES = [0, 0.995, 1]

type ComposeLiveTransitionOptions = {
  /**
   * `true` cuando la capa trae su propio fondo opaco a sangre (capa de tema,
   * slide de MEDIA). `false` cuando es contenido transparente que flota sobre
   * un fondo compartido que vive detras de ambas capas (texto de canciones,
   * versiculos, layers de presentacion).
   */
  opaqueLayer: boolean
}

type ComposedTransitionVariants = {
  initial: Record<string, unknown>
  animate: Record<string, unknown>
  exit: Record<string, unknown>
}

/**
 * Compone las variantes de una transicion en `live` para que salida y entrada
 * se crucen de verdad, sin pasar por negro.
 *
 * La estrategia depende de si la capa es opaca:
 *
 * - **Capa opaca**: si la saliente baja de 1 a 0 mientras la entrante sube de 0
 *   a 1, las dos quedan translucidas a la vez y se ve el fondo de detras. El
 *   cross real se consigue **no desvaneciendo la saliente**: se queda quieta y
 *   opaca debajo mientras la entrante aparece encima.
 * - **Capa transparente**: el fondo compartido esta detras de las dos, asi que
 *   el desvanecido simultaneo ya es un cross dissolve correcto. Aqui solo hay
 *   que igualar los tiempos para que la saliente no desaparezca antes de que la
 *   entrante haya terminado.
 */
export const composeLiveTransitionVariants = (
  variants: Variants,
  settings: AnimationSettings,
  type: AnimationType,
  { opaqueLayer }: ComposeLiveTransitionOptions
): ComposedTransitionVariants => {
  const initial = (variants.initial as Record<string, unknown>) ?? {}
  const animate = (variants.animate as Record<string, unknown>) ?? {}
  const exit = (variants.exit as Record<string, unknown>) ?? {}

  const passthrough = (): ComposedTransitionVariants => ({
    initial: { ...initial, opacity: initial.opacity ?? 1 },
    animate: { ...animate, opacity: animate.opacity ?? 1 },
    exit: { ...exit, opacity: exit.opacity ?? 1 }
  })

  // Sin animacion: corte seco, la capa saliente debe desaparecer al instante.
  if (type === 'none') {
    return {
      initial: { ...initial, opacity: 1 },
      animate: { ...animate, opacity: 1 },
      exit: { ...exit, opacity: 1 }
    }
  }

  const enterDuration = Math.max(0, settings.delay + settings.duration)

  if (enterDuration === 0) return passthrough()

  const animateTransition = (animate.transition as Record<string, unknown> | undefined) ?? {}
  const exitTransition = (exit.transition as Record<string, unknown> | undefined) ?? {}

  if (TRANSFORM_TRANSITION_TYPES.includes(type)) {
    // Las dos capas comparten compas: mismo `delay` y misma `duration`. Con el
    // `delay: 0` de antes, la saliente se iba antes de que la entrante
    // arrancara y dejaba un hueco en negro siempre que hubiera retardo.
    return {
      initial: { ...initial, opacity: 1 },
      animate: {
        ...animate,
        opacity: 1,
        transition: {
          ...animateTransition,
          duration: settings.duration,
          delay: settings.delay
        }
      },
      exit: {
        ...exit,
        opacity: 1,
        transition: {
          ...exitTransition,
          duration: settings.duration,
          delay: settings.delay
        }
      }
    }
  }

  // Tipos basados en opacidad: fade, blur, flip, bounce, rotate, split.
  if (opaqueLayer) {
    return {
      initial: { ...initial, opacity: initial.opacity ?? 1 },
      animate: { ...animate, opacity: animate.opacity ?? 1 },
      // Sin heredar `...exit`: la capa saliente no gira, ni escala, ni se
      // desenfoca. Solo espera a que la entrante termine de cubrirla.
      exit: {
        opacity: HOLD_KEYFRAMES,
        transition: {
          duration: enterDuration,
          times: HOLD_TIMES,
          ease: 'linear',
          delay: 0
        }
      }
    }
  }

  return {
    initial: { ...initial, opacity: initial.opacity ?? 1 },
    animate: { ...animate, opacity: animate.opacity ?? 1 },
    // El `exit` de `getAnimationVariants` dura `duration * 0.5`: el contenido
    // saliente se esfumaba a mitad de camino y quedaba un tramo con el entrante
    // aun translucido. Se estira para que ambos se crucen a la par.
    exit: {
      ...exit,
      opacity: exit.opacity ?? 1,
      transition: {
        ...exitTransition,
        duration: enterDuration,
        delay: 0
      }
    }
  }
}
