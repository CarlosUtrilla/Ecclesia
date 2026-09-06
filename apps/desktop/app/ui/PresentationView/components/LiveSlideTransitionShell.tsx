import { type ReactNode, useMemo } from 'react'
import { AnimatePresence, m, type TargetAndTransition, type Variants } from 'framer-motion'
import { getAnimationVariants, AnimationType } from '@/lib/animations'
import { AnimationSettings } from '@/lib/animationSettings'
import { parseAnimationSettings } from '../utils/parseAnimationSettings'
import { composeLiveTransitionVariants } from '../utils/composeLiveTransitionVariants'

type SlidePresenceVariantsCustom = {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
}

type Props = {
  slideTransitionRaw?: string
  slideKey: string | number
  /**
   * `true` cuando el slide pinta su propio fondo a sangre (items MEDIA, que
   * `MediaRender` envuelve en un contenedor `bg-black` a pantalla completa).
   * El texto de canciones/versiculos es transparente y flota sobre el fondo del
   * tema, que vive detras de las dos capas.
   */
  opaqueLayer?: boolean
  children: ReactNode
}

export function LiveSlideTransitionShell({
  slideTransitionRaw,
  slideKey,
  opaqueLayer = false,
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

  const composedSlideTransitionVariants = useMemo(
    () =>
      composeLiveTransitionVariants(
        slideTransitionVariants,
        slideTransitionSettings,
        slideTransitionType,
        { opaqueLayer }
      ),
    [slideTransitionType, slideTransitionVariants, slideTransitionSettings, opaqueLayer]
  )

  // Igual que en la capa de tema: el `custom` de `AnimatePresence` alcanza a la
  // capa saliente, asi que la animacion del slide entrante gobierna tambien su
  // salida. Sin esto la saliente usaria su propia duracion y, cuando difieren,
  // el `hold` acabaria antes que la entrada y dejaria un frame en negro.
  const slidePresenceCustom = useMemo<SlidePresenceVariantsCustom>(
    () => ({
      initial: composedSlideTransitionVariants.initial as TargetAndTransition,
      animate: composedSlideTransitionVariants.animate as TargetAndTransition,
      exit: composedSlideTransitionVariants.exit as TargetAndTransition
    }),
    [composedSlideTransitionVariants]
  )

  const slidePresenceVariants = useMemo<Variants>(
    () => ({
      initial: (custom) => (custom as SlidePresenceVariantsCustom).initial,
      animate: (custom) => (custom as SlidePresenceVariantsCustom).animate,
      exit: (custom) => (custom as SlidePresenceVariantsCustom).exit
    }),
    []
  )

  return (
    <AnimatePresence mode="sync" custom={slidePresenceCustom}>
      <m.div
        key={slideKey}
        custom={slidePresenceCustom}
        variants={slidePresenceVariants}
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
