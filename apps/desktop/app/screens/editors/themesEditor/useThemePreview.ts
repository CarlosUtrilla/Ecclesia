import { useMemo } from 'react'
import { defaultAnimationSettings, AnimationSettings } from '@/lib/animationSettings'
import { ThemeWithMedia } from '../../../ui/PresentationView/types'

const parseTranslate = (translateValue: unknown) => {
  if (typeof translateValue !== 'string') {
    return { x: 0, y: 0 }
  }

  const parts = translateValue.trim().split(/\s+/)
  const x = Number.parseFloat(parts[0] || '0')
  const y = Number.parseFloat(parts[1] || parts[0] || '0')

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  }
}

export function useThemePreview(watchedData: any) {
  const previewData = useMemo(() => {
    return {
      ...watchedData,
      textStyle: { ...(watchedData.textStyle || {}) },
      id: watchedData.id || 0,
      createdAt: watchedData.createdAt || new Date(),
      updatedAt: watchedData.updatedAt || new Date()
    } as ThemeWithMedia
  }, [watchedData])

  const translateValues = useMemo(
    () => parseTranslate(watchedData.textStyle?.translate),
    [watchedData.textStyle?.translate]
  )

  const animationSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(previewData.animationSettings)
    } catch {
      return defaultAnimationSettings
    }
  }, [previewData.animationSettings])

  const transitionSettings = useMemo<AnimationSettings>(() => {
    try {
      return JSON.parse(previewData.transitionSettings || '{}')
    } catch {
      return defaultAnimationSettings
    }
  }, [previewData.transitionSettings])

  return { previewData, translateValues, animationSettings, transitionSettings }
}

export default useThemePreview
