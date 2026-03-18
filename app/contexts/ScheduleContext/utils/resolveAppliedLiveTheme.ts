import type { ScheduleItem } from '@prisma/client'
import { BlankTheme } from '@/hooks/useThemes'
import { ThemeWithMedia } from '@/ui/PresentationView/types'

export function resolveAppliedLiveTheme(
  item: ScheduleItem | null,
  selectedTheme: ThemeWithMedia
): ThemeWithMedia {
  if (item?.type === 'PRESENTATION') {
    return BlankTheme
  }

  return selectedTheme
}