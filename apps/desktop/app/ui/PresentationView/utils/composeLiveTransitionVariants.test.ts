import { describe, expect, it } from 'vitest'
import { composeLiveTransitionVariants } from './composeLiveTransitionVariants'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'

const compose = (
  type: AnimationType,
  { opaqueLayer = true, ...overrides }: Partial<AnimationSettings> & { opaqueLayer?: boolean } = {}
) => {
  const settings: AnimationSettings = {
    type,
    duration: 0.6,
    delay: 0,
    easing: 'easeInOut',
    ...overrides
  }

  return composeLiveTransitionVariants(
    getAnimationVariants(type, settings.duration, settings.delay, settings.easing),
    settings,
    type,
    { opaqueLayer }
  )
}

const transitionOf = (variant: Record<string, unknown>) =>
  variant.transition as Record<string, unknown>

describe('composeLiveTransitionVariants: capa opaca', () => {
  it('en fade mantiene opaca la capa saliente para que el cross no pase por negro', () => {
    const composed = compose('fade')

    // La entrante sube de 0 a 1 encima; la saliente se queda quieta y opaca.
    expect(composed.initial.opacity).toBe(0)
    expect(composed.animate.opacity).toBe(1)
    expect(composed.exit.opacity).toEqual([1, 1, 0])
  })

  it('estira el exit hasta cubrir delay + duration de la entrada', () => {
    const composed = compose('fade', { duration: 0.8, delay: 0.2 })

    expect(transitionOf(composed.exit).duration).toBeCloseTo(1)
    expect(transitionOf(composed.exit).delay).toBe(0)
    // Sin un valor que cambie de verdad framer-motion desmontaria al instante.
    expect(transitionOf(composed.exit).times).toEqual([0, 0.995, 1])
  })

  it('no arrastra transforms de la variante exit a la capa que solo espera', () => {
    const composed = compose('blur')

    expect(composed.exit.filter).toBeUndefined()
    expect(composed.exit.opacity).toEqual([1, 1, 0])
  })
})

describe('composeLiveTransitionVariants: capa transparente', () => {
  it('cruza por desvanecido simultaneo, sin hold', () => {
    const composed = compose('fade', { opaqueLayer: false })

    // El fondo compartido esta detras de las dos capas: no hay negro que tapar.
    expect(composed.initial.opacity).toBe(0)
    expect(composed.animate.opacity).toBe(1)
    expect(composed.exit.opacity).toBe(0)
  })

  it('iguala la duracion del exit con la de la entrada', () => {
    // `getAnimationVariants` da al exit `duration * 0.5`: el contenido saliente
    // se esfumaba a mitad de camino.
    expect(getAnimationVariants('fade', 0.8, 0.2).exit).toMatchObject({
      transition: { duration: 0.4 }
    })

    const composed = compose('fade', { duration: 0.8, delay: 0.2, opaqueLayer: false })

    expect(transitionOf(composed.exit).duration).toBeCloseTo(1)
    expect(transitionOf(composed.exit).delay).toBe(0)
  })

  it('conserva el resto de la variante exit (blur, rotate...)', () => {
    const composed = compose('blur', { opaqueLayer: false })

    expect(composed.exit.filter).toBe('blur(10px)')
    expect(composed.exit.opacity).toBe(0)
  })
})

describe('composeLiveTransitionVariants: casos comunes', () => {
  it.each([true, false])('deja el corte seco intacto en none (opaqueLayer=%s)', (opaqueLayer) => {
    const composed = compose('none', { opaqueLayer })

    expect(composed.exit.opacity).toBe(1)
    expect(composed.exit.transition).toBeUndefined()
  })

  it.each([true, false])(
    'mueve las dos capas al mismo compas en slide/zoom (opaqueLayer=%s)',
    (opaqueLayer) => {
      const composed = compose('slideLeft', { duration: 0.6, delay: 0.3, opaqueLayer })

      expect(composed.initial.opacity).toBe(1)
      expect(composed.animate.opacity).toBe(1)
      expect(composed.exit.opacity).toBe(1)
      expect(composed.initial.x).toBe('-100%')
      expect(composed.exit.x).toBe('100%')

      // Mismo delay en ambas: con `delay: 0` la saliente se iba antes de que la
      // entrante arrancara y dejaba un hueco en negro.
      expect(transitionOf(composed.animate).duration).toBe(0.6)
      expect(transitionOf(composed.animate).delay).toBe(0.3)
      expect(transitionOf(composed.exit).duration).toBe(0.6)
      expect(transitionOf(composed.exit).delay).toBe(0.3)
    }
  )

  it.each([true, false])(
    'no genera keyframes cuando la transicion dura cero (opaqueLayer=%s)',
    (opaqueLayer) => {
      const composed = compose('fade', { duration: 0, delay: 0, opaqueLayer })

      expect(composed.exit.opacity).toBe(0)
    }
  )
})
