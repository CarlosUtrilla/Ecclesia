import { ScreenRol } from '@prisma/client'

export type CreateSelectedScreenDTO = {
  screenId: number
  screenName: string
  rol?: ScreenRol | null
}

export type UpdateSelectedScreenDTO = {
  id: number
  screenId?: number
  screenName?: string
  rol?: ScreenRol | null
}

export type SelectedScreenFilter = {
  rol?: ScreenRol
  screenId?: number
}
