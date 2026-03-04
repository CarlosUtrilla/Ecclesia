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

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={slideKey}
        variants={slideTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0"
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
