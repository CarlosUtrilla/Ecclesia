import { describe, expect, it } from 'vitest'
import {
  buildGlobalStageUpsertPayloads,
  getGlobalStageConfig,
  resolveGlobalStageSelectedScreenId
} from './globalStageConfig'

describe('globalStageConfig', () => {
  const stageScreens = [
    { id: 10, screenId: 200 },
    { id: 11, screenId: 201 }
  ]

  it('deberia devolver null cuando no hay pantallas stage', () => {
    expect(resolveGlobalStageSelectedScreenId([], [])).toBeNull()
    expect(getGlobalStageConfig([], [])).toBeNull()
  })

  it('deberia usar la primera pantalla con config existente segun orden stage', () => {
    const selectedScreenId = resolveGlobalStageSelectedScreenId(stageScreens, [
      { selectedScreenId: 11 },
      { selectedScreenId: 999 }
    ])

    expect(selectedScreenId).toBe(11)
  })

  it('deberia usar la primera pantalla stage si no hay config guardada', () => {
    const selectedScreenId = resolveGlobalStageSelectedScreenId(stageScreens, [
      { selectedScreenId: 999 }
    ])

    expect(selectedScreenId).toBe(10)
  })

  it('deberia devolver config global y selectedScreenId', () => {
    const result = getGlobalStageConfig(stageScreens, [
      { selectedScreenId: 11, themeId: 5 },
      { selectedScreenId: 77, themeId: 8 }
    ])

    expect(result).toEqual({
      selectedScreenId: 11,
      config: { selectedScreenId: 11, themeId: 5 }
    })
  })

  it('deberia crear payloads para todas las pantallas stage', () => {
    const payloads = buildGlobalStageUpsertPayloads(stageScreens, {
      themeId: 3,
      state: '{"message":"ok"}'
    })

    expect(payloads).toEqual([
      { selectedScreenId: 10, themeId: 3, state: '{"message":"ok"}' },
      { selectedScreenId: 11, themeId: 3, state: '{"message":"ok"}' }
    ])
  })
})
