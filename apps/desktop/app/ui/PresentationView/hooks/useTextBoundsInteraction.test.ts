/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import {
  resolveAllowedInteractionMode,
  resolveSnapCenterThreshold
} from './useTextBoundsInteraction'

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

  describe('resolveSnapCenterThreshold', () => {
    it('deberia usar el umbral base cuando el margen es pequeno', () => {
      expect(resolveSnapCenterThreshold(0)).toBe(8)
      expect(resolveSnapCenterThreshold(8)).toBe(8)
    })

    it('deberia escalar el umbral con el margen disponible', () => {
      expect(resolveSnapCenterThreshold(16)).toBe(12)
      expect(resolveSnapCenterThreshold(40)).toBe(30)
    })

    it('deberia dejar la zona muerta reducida respecto al clamp (±margin)', () => {
      const threshold = resolveSnapCenterThreshold(16)
      expect(threshold).toBeGreaterThanOrEqual(16 * 0.75)
      expect(threshold).toBeLessThan(16)
    })
  })
})