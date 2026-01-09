import { Themes } from '@prisma/client'
export type CreateThemeDto = Omit<Themes, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateThemeDto = Omit<Themes, 'createdAt' | 'updatedAt'>
