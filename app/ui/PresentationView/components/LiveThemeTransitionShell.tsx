import { type ReactNode, useMemo } from 'react'
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  type TargetAndTransition,
  type Variants
} from 'framer-motion'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'
import { parseAnimationSettings } from '../utils/parseAnimationSettings'

type ThemePresenceVariantsCustom = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

type Props = {
  themeTransitionRaw?: string
  themeTransitionKey?: number
  themeId?: number
  children: ReactNode
}

export function LiveThemeTransitionShell({
  themeTransitionRaw,
  themeTransitionKey,
  themeId,
  children
}: Props) {
  const themeTransitionSettings = useMemo<AnimationSettings>(
    () => parseAnimationSettings(themeTransitionRaw),
    [themeTransitionRaw]
  )

  const themeTransitionType = (themeTransitionSettings.type || 'fade') as AnimationType

  const themeTransitionVariants = useMemo(
    () =>
      getAnimationVariants(
        themeTransitionType,
        themeTransitionSettings.duration,
        themeTransitionSettings.delay,
        themeTransitionSettings.easing
      ),
    [
      themeTransitionType,
      themeTransitionSettings.duration,
      themeTransitionSettings.delay,
      themeTransitionSettings.easing
    ]
  )

  const composedThemeTransitionVariants = useMemo(() => {
    // Para transiciones live evitamos huecos de opacidad entre salida/entrada
    // para que no se vea negro durante el cambio de item/tema.
    const shouldForceSolidOpacity = [
      'slideLeft',
      'slideRight',
      'slideUp',
      'slideDown',
      'zoomIn',
      'zoomOut',
      'scale'
    ].includes(themeTransitionType)

    if (!shouldForceSolidOpacity) {
      return themeTransitionVariants
    }

    const initial = (themeTransitionVariants.initial as Record<string, unknown>) ?? {}
    const animate = (themeTransitionVariants.animate as Record<string, unknown>) ?? {}
    const exit = (themeTransitionVariants.exit as Record<string, unknown>) ?? {}

    const animateTransition = (animate.transition as Record<string, unknown> | undefined) ?? {}
    const exitTransition = (exit.transition as Record<string, unknown> | undefined) ?? {}

    return {
      ...themeTransitionVariants,
      initial: {
        ...initial,
        opacity: 1
      },
      animate: {
        ...animate,
        opacity: 1,
        transition: {
          ...animateTransition,
          duration: themeTransitionSettings.duration,
          delay: themeTransitionSettings.delay
        }
      },
      exit: {
        ...exit,
        opacity: 1,
        transition: {
          ...exitTransition,
          duration: themeTransitionSettings.duration,
          delay: 0
        }
      }
    }
  }, [themeTransitionType, themeTransitionVariants, themeTransitionSettings])

  const themePresenceCustom = useMemo<ThemePresenceVariantsCustom>(
    () => ({
      initial: (composedThemeTransitionVariants.initial ?? {}) as TargetAndTransition,
      animate: (composedThemeTransitionVariants.animate ?? {}) as TargetAndTransition,
      exit: (composedThemeTransitionVariants.exit ?? {}) as TargetAndTransition
    }),
    [composedThemeTransitionVariants]
  )

  const themePresenceVariants = useMemo<Variants>(
    () => ({
      initial: (custom) => (custom as ThemePresenceVariantsCustom).initial,
      animate: (custom) => (custom as ThemePresenceVariantsCustom).animate,
      exit: (custom) => (custom as ThemePresenceVariantsCustom).exit
    }),
    []
  )

  const resolvedThemeTransitionKey = themeTransitionKey ?? themeId ?? 0

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="sync" custom={themePresenceCustom}>
        <m.div
          key={`theme-${resolvedThemeTransitionKey}`}
          custom={themePresenceCustom}
          variants={themePresenceVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 w-full h-full overflow-hidden"
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
