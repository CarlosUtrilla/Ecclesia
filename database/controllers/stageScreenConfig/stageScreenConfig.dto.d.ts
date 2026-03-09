export type StageScreenConfigFilterDTO = {
  selectedScreenId?: number
  themeId?: number
}

export type UpsertStageScreenConfigDTO = {
  selectedScreenId: number
  themeId?: number | null
  layout?: string
  state?: string
}

export type UpdateStageScreenThemeDTO = {
  selectedScreenId: number
  themeId: number | null
}

export type UpdateStageScreenLayoutDTO = {
  selectedScreenId: number
  layout: string
}

export type UpdateStageScreenStateDTO = {
  selectedScreenId: number
  state: string
}
