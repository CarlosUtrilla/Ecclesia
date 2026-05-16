import { AnimationSettings, defaultAnimationSettings } from '@/lib/animationSettings'

export const parseAnimationSettings = (raw?: string): AnimationSettings => {
  try {
    return {
      ...defaultAnimationSettings,
      ...(raw ? JSON.parse(raw) : {})
    }
  } catch {
    return defaultAnimationSettings
  }
}
