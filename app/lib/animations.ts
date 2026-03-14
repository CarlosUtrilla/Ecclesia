import { Variants } from 'framer-motion'
import React from 'react'
import {
  FadeIcon,
  SlideLeftIcon,
  SlideRightIcon,
  SlideUpIcon,
  SlideDownIcon,
  ZoomInIcon,
  ZoomOutIcon,
  BlurIcon,
  ScaleIcon,
  FlipIcon,
  BounceIcon,
  RotateIcon,
  SplitIcon,
  NoneIcon
} from '@/icons/animations'
import { easingOptions, EasingType } from './animationSettings'

export type AnimationType =
  | 'none'
  | 'fade'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'blur'
  | 'scale'
  | 'flip'
  | 'bounce'
  | 'rotate'
  | 'split'

export type AnimationConfig = {
  label: string
  value: AnimationType
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export const animations: AnimationConfig[] = [
  {
    label: 'Sin animación',
    value: 'none',
    description: 'Sin transición',
    icon: NoneIcon
  },
  {
    label: 'Fade',
    value: 'fade',
    description: 'Aparición/desaparición gradual',
    icon: FadeIcon
  },
  {
    label: 'Deslizar desde izquierda',
    value: 'slideLeft',
    description: 'El texto entra desde la izquierda',
    icon: SlideLeftIcon
  },
  {
    label: 'Deslizar desde derecha',
    value: 'slideRight',
    description: 'El texto entra desde la derecha',
    icon: SlideRightIcon
  },
  {
    label: 'Deslizar desde arriba',
    value: 'slideUp',
    description: 'El texto entra desde arriba',
    icon: SlideUpIcon
  },
  {
    label: 'Deslizar desde abajo',
    value: 'slideDown',
    description: 'El texto entra desde abajo',
    icon: SlideDownIcon
  },
  {
    label: 'Zoom In',
    value: 'zoomIn',
    description: 'El texto aparece acercándose',
    icon: ZoomInIcon
  },
  {
    label: 'Zoom Out',
    value: 'zoomOut',
    description: 'El texto aparece alejándose',
    icon: ZoomOutIcon
  },
  {
    label: 'Desenfoque',
    value: 'blur',
    description: 'Desde borroso a enfocado',
    icon: BlurIcon
  },
  {
    label: 'Escala',
    value: 'scale',
    description: 'Escala desde pequeño',
    icon: ScaleIcon
  },
  {
    label: 'Voltear',
    value: 'flip',
    description: 'Efecto de voltear',
    icon: FlipIcon
  },
  {
    label: 'Rebote',
    value: 'bounce',
    description: 'Entra con rebote',
    icon: BounceIcon
  },
  {
    label: 'Rotar',
    value: 'rotate',
    description: 'Rota mientras entra',
    icon: RotateIcon
  },
  {
    label: 'División',
    value: 'split',
    description: 'Las palabras aparecen por separado',
    icon: SplitIcon
  }
]

// Variantes de animación para Framer Motion
export const getAnimationVariants = (
  type: AnimationType,
  duration = 0.6,
  delay = 0,
  easing: EasingType = 'easeInOut'
): Variants => {
  const easingConfig = easingOptions.find((e) => e.value === easing)
  const easeCurve = easingConfig?.curve || [0.43, 0.13, 0.23, 0.96]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseTransition: any = {
    duration,
    delay,
    ease: easeCurve
  }

  const variants: Record<AnimationType, Variants> = {
    none: {
      initial: {},
      animate: {},
      exit: {}
    },
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: baseTransition },
      exit: { opacity: 0, transition: { duration: duration * 0.5 } }
    },
    slideLeft: {
      initial: { x: '-100%', opacity: 0 },
      animate: { x: 0, opacity: 1, transition: baseTransition },
      exit: { x: '100%', opacity: 0, transition: { duration: duration * 0.5 } }
    },
    slideRight: {
      initial: { x: '100%', opacity: 0 },
      animate: { x: 0, opacity: 1, transition: baseTransition },
      exit: { x: '-100%', opacity: 0, transition: { duration: duration * 0.5 } }
    },
    slideUp: {
      initial: { y: '-100%', opacity: 0 },
      animate: { y: 0, opacity: 1, transition: baseTransition },
      exit: { y: '100%', opacity: 0, transition: { duration: duration * 0.5 } }
    },
    slideDown: {
      initial: { y: '100%', opacity: 0 },
      animate: { y: 0, opacity: 1, transition: baseTransition },
      exit: { y: '-100%', opacity: 0, transition: { duration: duration * 0.5 } }
    },
    zoomIn: {
      initial: { scale: 0.5, opacity: 0 },
      animate: { scale: 1, opacity: 1, transition: baseTransition },
      exit: { scale: 1.5, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    zoomOut: {
      initial: { scale: 1.5, opacity: 0 },
      animate: { scale: 1, opacity: 1, transition: baseTransition },
      exit: { scale: 0.5, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    blur: {
      initial: { filter: 'blur(10px)', opacity: 0 },
      animate: { filter: 'blur(0px)', opacity: 1, transition: baseTransition },
      exit: { filter: 'blur(10px)', opacity: 0, transition: { duration: duration * 0.5 } }
    },
    scale: {
      initial: { scale: 0, opacity: 0 },
      animate: { scale: 1, opacity: 1, transition: baseTransition },
      exit: { scale: 0, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    flip: {
      initial: { rotateY: 90, opacity: 0 },
      animate: { rotateY: 0, opacity: 1, transition: baseTransition },
      exit: { rotateY: -90, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    bounce: {
      initial: { y: -100, opacity: 0 },
      animate: {
        y: 0,
        opacity: 1,
        transition: {
          ...baseTransition,
          type: 'spring',
          stiffness: 300,
          damping: 15
        }
      },
      exit: { y: 100, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    rotate: {
      initial: { rotate: -180, scale: 0, opacity: 0 },
      animate: { rotate: 0, scale: 1, opacity: 1, transition: baseTransition },
      exit: { rotate: 180, scale: 0, opacity: 0, transition: { duration: duration * 0.5 } }
    },
    split: {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: {
          staggerChildren: duration * 0.12,
          delayChildren: duration * 0.1
        }
      },
      exit: { opacity: 0, transition: { duration: duration * 0.3 } }
    }
  }

  return variants[type]
}

// Variantes para palabras individuales (usado en animación 'split')
export function getWordVariants(duration = 0.4): Variants {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration } }
  }
}

/** @deprecated Usar getWordVariants(duration) para respetar la velocidad configurada */
export const wordVariants: Variants = getWordVariants()
