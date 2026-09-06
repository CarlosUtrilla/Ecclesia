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
import { composeLiveTransitionVariants } from '../utils/composeLiveTransitionVariants'

type ThemePresenceVariantsCustom = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

type Props = {
  themeTransitionRaw?: string
  themeTransitionKey?: number | string
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

  const composedThemeTransitionVariants = useMemo(
    () =>
      composeLiveTransitionVariants(
        themeTransitionVariants,
        themeTransitionSettings,
        themeTransitionType,
        // Cada capa de tema trae su propio fondo a sangre.
        { opaqueLayer: true }
      ),
    [themeTransitionType, themeTransitionVariants, themeTransitionSettings]
  )

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
