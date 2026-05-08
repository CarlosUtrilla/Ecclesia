/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { resolveAllowedInteractionMode } from './useTextBoundsInteraction'

describe('useTextBoundsInteraction', () => {
  it('deberia degradar esquinas a resize horizontal cuando el componente solo permite lados', () => {
    expect(
      resolveAllowedInteractionMode('resize-top-left', ['move', 'resize-left', 'resize-right'])
    ).toBe('resize-left')

    expect(
      resolveAllowedInteractionMode('resize-bottom-right', ['move', 'resize-left', 'resize-right'])
    ).toBe('resize-right')
  })

  it('deberia volver a move cuando el modo detectado no esta permitido', () => {
    expect(resolveAllowedInteractionMode('resize-top', ['move', 'resize-left'])).toBe('move')
  })
})