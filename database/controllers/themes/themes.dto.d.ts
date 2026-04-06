import { BiblePresentationSettings, Media, Themes } from '@prisma/client'
import * as React from 'react'
export type CreateThemeDto = Omit<UpdateThemeDto, 'biblePresentationSettingsId'> & {
  biblePresentationSettingsId?: number | null
}

export type UpdateThemeDto = Omit<Themes, 'createdAt' | 'updatedAt' | 'id' | 'textStyle'> & {
  biblePresentationSettings?: Omit<
    BiblePresentationSettings,
    'id' | 'isGlobal' | 'defaultTheme' | 'updatedAt'
  > | null
  textStyle: React.CSSProperties
}

export type ThemeWithMedia = Omit<Themes, 'textStyle'> & {
  backgroundMedia?: Media | null
  biblePresentationSettings: BiblePresentationSettings | null
  textStyle: React.CSSProperties
}

export type ThemeArchiveExportResult = {
  outputPath: string
  themeName: string
  hasBackgroundMedia: boolean
}

export type ThemeArchiveImportResult = {
  themeId: number
  themeName: string
  hasBackgroundMedia: boolean
  backgroundMediaFilePath?: string
  backgroundMediaWasRenamed?: boolean
}
