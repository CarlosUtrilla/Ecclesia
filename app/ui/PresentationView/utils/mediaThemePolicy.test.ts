import { describe, expect, it } from 'vitest'
import { shouldOmitThemeForLiveMediaItem } from './mediaThemePolicy'

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
