import type { ScheduleItem } from '@ecclesia/api'
import { BlankTheme } from '@/hooks/useThemes'
import { ThemeWithMedia } from '@/ui/PresentationView/types'
import { parseTimerAccessData } from '@/lib/timerAccessData'

export function resolveAppliedLiveTheme(
  item: ScheduleItem | null,
  selectedTheme: ThemeWithMedia,
  themes: ThemeWithMedia[] = []
): ThemeWithMedia {
  if (item?.type === 'PRESENTATION') {
    return BlankTheme
  }

  if (item?.type === 'TIMER') {
    const { themeId } = parseTimerAccessData(item.accessData)
    if (themeId != null) {
      const timerTheme = themes.find((theme) => theme.id === themeId)
      if (timerTheme) return timerTheme
    }
    return selectedTheme
  }

  return selectedTheme
}
