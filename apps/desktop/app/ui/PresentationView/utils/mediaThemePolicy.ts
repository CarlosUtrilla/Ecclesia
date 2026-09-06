import { BlankTheme } from '@/hooks/useThemes'
import { PresentationViewItems, ThemeWithMedia } from '../types'

type ShouldOmitThemeForLiveMediaItemParams = {
  live: boolean
  currentItem?: PresentationViewItems
}

export const LIVE_MEDIA_NEUTRAL_THEME: ThemeWithMedia = {
  ...BlankTheme,
  id: -2,
  name: 'Live Media Neutral',
  background: '#000000',
  animationSettings: '{"type":"none","duration":0,"delay":0,"easing":"linear"}',
  transitionSettings: '{"type":"none","duration":0,"delay":0,"easing":"linear"}'
}

/**
 * Tema neutro para items MEDIA en live. Hereda la `transitionSettings` del tema
 * que estaba aplicado para que el salto tema -> video siga cruzandose con la
 * misma animacion configurada; sin esto el cambio a un video era un corte seco
 * porque el tema neutro declara `type: 'none'`.
 */
export const buildLiveMediaNeutralTheme = (previousTheme?: ThemeWithMedia): ThemeWithMedia => {
  const inheritedTransition = previousTheme?.transitionSettings

  if (!inheritedTransition) return LIVE_MEDIA_NEUTRAL_THEME

  return {
    ...LIVE_MEDIA_NEUTRAL_THEME,
    transitionSettings: inheritedTransition
  }
}

export const shouldOmitThemeForLiveMediaItem = ({
  live,
  currentItem
}: ShouldOmitThemeForLiveMediaItemParams): boolean => {
  return live && currentItem?.resourceType === 'MEDIA'
}
