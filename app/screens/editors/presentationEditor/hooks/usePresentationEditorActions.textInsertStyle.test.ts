import { describe, expect, it } from 'vitest'
import { getNoThemeBibleInsertStyle } from './usePresentationEditorActions'

describe('usePresentationEditorActions no-theme bible insert style', () => {
  it('deberia usar 90% de ancho y alto centrado en canvas', () => {
    const style = getNoThemeBibleInsertStyle()

    expect(style.width).toBe(1152)
    expect(style.height).toBe(648)
    expect(style.x).toBe(64)
    expect(style.y).toBe(36)
  })
})
