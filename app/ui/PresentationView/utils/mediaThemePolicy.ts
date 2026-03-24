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

export const shouldOmitThemeForLiveMediaItem = ({
  live,
  currentItem
}: ShouldOmitThemeForLiveMediaItemParams): boolean => {
  return live && currentItem?.resourceType === 'MEDIA'
}
