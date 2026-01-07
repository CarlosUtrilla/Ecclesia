export type AnimationSettings = {
  type: string // AnimationType
  duration: number // Duración en segundos (0.1 - 3)
  delay: number // Retraso antes de iniciar (0 - 2)
  easing: EasingType
}

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'circIn'
  | 'circOut'
  | 'circInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'

export type EasingConfig = {
  label: string
  value: EasingType
  curve: number[]
}

export const easingOptions: EasingConfig[] = [
  { label: 'Linear', value: 'linear', curve: [0, 0, 1, 1] },
  { label: 'Ease In', value: 'easeIn', curve: [0.42, 0, 1, 1] },
  { label: 'Ease Out', value: 'easeOut', curve: [0, 0, 0.58, 1] },
  { label: 'Ease In-Out', value: 'easeInOut', curve: [0.42, 0, 0.58, 1] },
  { label: 'Circ In', value: 'circIn', curve: [0.55, 0, 1, 0.45] },
  { label: 'Circ Out', value: 'circOut', curve: [0, 0.55, 0.45, 1] },
  { label: 'Circ In-Out', value: 'circInOut', curve: [0.85, 0, 0.15, 1] },
  { label: 'Back In', value: 'backIn', curve: [0.36, 0, 0.66, -0.56] },
  { label: 'Back Out', value: 'backOut', curve: [0.34, 1.56, 0.64, 1] },
  { label: 'Back In-Out', value: 'backInOut', curve: [0.68, -0.6, 0.32, 1.6] }
]

export const defaultAnimationSettings: AnimationSettings = {
  type: 'fade',
  duration: 0.4,
  delay: 0,
  easing: 'easeInOut'
}
