import { BiblePresentationSettings, Themes } from '@prisma/client'
export type CreateThemeDto = Omit<UpdateThemeDto, 'biblePresentationSettingsId'> & {
  biblePresentationSettingsId?: number | null
}

export type UpdateThemeDto = Omit<Themes, 'createdAt' | 'updatedAt' | 'id'> & {
  biblePresentationSettings?: Omit<
    BiblePresentationSettings,
    'id' | 'isGlobal' | 'defaultTheme'
  > | null
}
