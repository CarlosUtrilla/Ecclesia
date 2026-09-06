import { describe, expect, it } from 'vitest'
import {
  LIVE_MEDIA_NEUTRAL_THEME,
  buildLiveMediaNeutralTheme,
  shouldOmitThemeForLiveMediaItem
} from './mediaThemePolicy'

describe('mediaThemePolicy', () => {
  it('deberia omitir tema cuando el item en live es MEDIA', () => {
    expect(
      shouldOmitThemeForLiveMediaItem({
        live: true,
        currentItem: {
          text: '',
          resourceType: 'MEDIA'
        }
      })
    ).toBe(true)
  })

  it('no deberia omitir tema cuando no es live', () => {
    expect(
      shouldOmitThemeForLiveMediaItem({
        live: false,
        currentItem: {
          text: '',
          resourceType: 'MEDIA'
        }
      })
    ).toBe(false)
  })

  it('no deberia omitir tema para recursos no MEDIA', () => {
    expect(
      shouldOmitThemeForLiveMediaItem({
        live: true,
        currentItem: {
          text: 'Texto',
          resourceType: 'BIBLE'
        }
      })
    ).toBe(false)
  })
})

describe('buildLiveMediaNeutralTheme', () => {
  it('hereda la transicion del tema aplicado para no cortar en seco al entrar un video', () => {
    const neutral = buildLiveMediaNeutralTheme({
      transitionSettings: '{"type":"fade","duration":0.6,"delay":0,"easing":"easeInOut"}'
    } as never)

    expect(neutral.transitionSettings).toBe(
      '{"type":"fade","duration":0.6,"delay":0,"easing":"easeInOut"}'
    )
    expect(neutral.background).toBe('#000000')
    expect(neutral.id).toBe(-2)
  })

  it('usa el tema neutro tal cual cuando el tema aplicado no define transicion', () => {
    expect(buildLiveMediaNeutralTheme(undefined)).toBe(LIVE_MEDIA_NEUTRAL_THEME)
    expect(buildLiveMediaNeutralTheme({} as never)).toBe(LIVE_MEDIA_NEUTRAL_THEME)
  })
})
