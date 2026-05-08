/* eslint-env vitest */

import { describe, expect, it } from 'vitest'
import { BiblePresentationSchema } from './schema'

describe('BiblePresentationSchema', () => {
  it('deberia aceptar la posicion downScreen', () => {
    const parsed = BiblePresentationSchema.parse({
      description: 'complete',
      position: 'downScreen',
      showVersion: true,
      showVerseNumber: false,
      positionStyle: 10
    })

    expect(parsed.position).toBe('downScreen')
  })
})
