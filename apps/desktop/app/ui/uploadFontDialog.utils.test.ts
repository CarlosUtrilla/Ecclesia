/* eslint-env vitest */

import { describe, expect, it } from 'vitest'

import { planFontUploads } from './uploadFontDialog.utils'

describe('planFontUploads', () => {
  it('filtra duplicados existentes y repetidos en el mismo lote', () => {
    const result = planFontUploads(
      ['Poppins-Bold.ttf', 'Poppins-Bold.ttf', 'Inter-Regular.ttf', 'Lato-Regular.ttf'],
      ['Inter-Regular.ttf']
    )

    expect(result.toUpload).toEqual(['Poppins-Bold.ttf', 'Lato-Regular.ttf'])
    expect(result.skippedDuplicates).toEqual(['Poppins-Bold.ttf', 'Inter-Regular.ttf'])
  })
})
