import { describe, expect, it } from 'vitest'
import { mergeConsecutiveReferences } from './ai.references'

const ref = (book: string, chapter: number, verseStart: number, verseEnd?: number) => ({
  book,
  chapter,
  verseStart,
  verseEnd
})

describe('mergeConsecutiveReferences', () => {
  it('deberia agrupar versiculos sueltos que van de corrido', () => {
    const result = mergeConsecutiveReferences([
      ref('Juan', 15, 15),
      ref('Juan', 15, 16),
      ref('Juan', 15, 17),
      ref('Juan', 15, 18)
    ])

    expect(result).toEqual([ref('Juan', 15, 15, 18)])
  })

  it('no deberia agrupar cuando hay otra referencia en medio', () => {
    const result = mergeConsecutiveReferences([
      ref('Juan', 15, 15),
      ref('Mateo', 5, 3),
      ref('Juan', 15, 16)
    ])

    expect(result).toEqual([ref('Juan', 15, 15), ref('Mateo', 5, 3), ref('Juan', 15, 16)])
  })

  it('deberia extender un rango con el versiculo siguiente o uno solapado', () => {
    const result = mergeConsecutiveReferences([
      ref('Juan', 15, 15, 17),
      ref('Juan', 15, 18),
      ref('Juan', 15, 17, 20)
    ])

    expect(result).toEqual([ref('Juan', 15, 15, 20)])
  })

  it('no deberia agrupar versiculos con salto, de otro capitulo o hacia atras', () => {
    const result = mergeConsecutiveReferences([
      ref('Hechos', 2, 19),
      ref('Hechos', 2, 25),
      ref('Hechos', 3, 1),
      ref('Hechos', 2, 26)
    ])

    expect(result).toHaveLength(4)
  })

  it('deberia tratar un versiculo repetido como uno solo', () => {
    expect(mergeConsecutiveReferences([ref('Juan', 3, 16), ref('Juan', 3, 16)])).toEqual([
      ref('Juan', 3, 16)
    ])
  })
})
