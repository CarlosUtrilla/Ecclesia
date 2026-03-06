import { type ReactNode, useMemo } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'
import { parseAnimationSettings } from '../utils/parseAnimationSettings'

type Props = {
  slideTransitionRaw?: string
  slideKey: string | number
  children: ReactNode
}

export function LiveSlideTransitionShell({
  slideTransitionRaw,
  slideKey,
  children
}: Props) {
  const slideTransitionSettings = useMemo<AnimationSettings>(
    () => parseAnimationSettings(slideTransitionRaw),
    [slideTransitionRaw]
  )

  const slideTransitionType = (slideTransitionSettings.type || 'fade') as AnimationType

  const slideTransitionVariants = useMemo(
    () =>
      getAnimationVariants(
        slideTransitionType,
        slideTransitionSettings.duration,
        slideTransitionSettings.delay,
        slideTransitionSettings.easing
      ),
    [
      slideTransitionType,
      slideTransitionSettings.duration,
      slideTransitionSettings.delay,
      slideTransitionSettings.easing
    ]
  )

  const composedSlideTransitionVariants = useMemo(() => {
    // En transiciones de items en vivo evitamos huecos de opacidad para que
    // la entrada/salida se perciba como empuje continuo, sin mostrar fondo negro.
    const shouldForceSolidOpacity = [
      'slideLeft',
      'slideRight',
      'slideUp',
      'slideDown',
      'zoomIn',
      'zoomOut',
      'scale'
    ].includes(slideTransitionType)

    if (!shouldForceSolidOpacity) {
      return slideTransitionVariants
    }

    const initial = (slideTransitionVariants.initial as Record<string, unknown>) ?? {}
    const animate = (slideTransitionVariants.animate as Record<string, unknown>) ?? {}
    const exit = (slideTransitionVariants.exit as Record<string, unknown>) ?? {}

    const animateTransition =
      (animate.transition as Record<string, unknown> | undefined) ?? {}
    const exitTransition = (exit.transition as Record<string, unknown> | undefined) ?? {}

    return {
      ...slideTransitionVariants,
      initial: {
        ...initial,
        opacity: 1
      },
      animate: {
        ...animate,
        opacity: 1,
        transition: {
          ...animateTransition,
          duration: slideTransitionSettings.duration,
          delay: slideTransitionSettings.delay
        }
      },
      exit: {
        ...exit,
        opacity: 1,
        transition: {
          ...exitTransition,
          duration: slideTransitionSettings.duration,
          delay: 0
        }
      }
    }
  }, [slideTransitionType, slideTransitionVariants, slideTransitionSettings])

  return (
    <AnimatePresence mode="sync">
      <m.div
        key={slideKey}
        variants={composedSlideTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 overflow-hidden"
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
