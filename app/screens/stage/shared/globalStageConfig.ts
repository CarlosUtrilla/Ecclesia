type StageScreenLike = {
  id: number
}

type StageConfigLike = {
  selectedScreenId: number
}

export function resolveGlobalStageSelectedScreenId(
  stageScreens: StageScreenLike[],
  stageConfigs: StageConfigLike[]
): number | null {
  if (stageScreens.length === 0) return null

  for (const stageScreen of stageScreens) {
    const hasConfig = stageConfigs.some((config) => config.selectedScreenId === stageScreen.id)
    if (hasConfig) {
      return stageScreen.id
    }
  }

  return stageScreens[0].id
}

export function getGlobalStageConfig<T extends StageConfigLike>(
  stageScreens: StageScreenLike[],
  stageConfigs: T[]
): { selectedScreenId: number; config: T | null } | null {
  const selectedScreenId = resolveGlobalStageSelectedScreenId(stageScreens, stageConfigs)
  if (selectedScreenId === null) return null

  const config = stageConfigs.find((item) => item.selectedScreenId === selectedScreenId) ?? null

  return {
    selectedScreenId,
    config
  }
}

export function buildGlobalStageUpsertPayloads<T extends Record<string, unknown>>(
  stageScreens: StageScreenLike[],
  payload: T
): Array<T & { selectedScreenId: number }> {
  if (stageScreens.length === 0) return []

  return stageScreens.map((stageScreen) => ({
    ...payload,
    selectedScreenId: stageScreen.id
  }))
}
