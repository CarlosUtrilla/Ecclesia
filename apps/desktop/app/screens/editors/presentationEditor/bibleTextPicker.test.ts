// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { scrollToVerseInContainer } from './bibleTextPicker'

describe('bibleTextPicker scrollToVerseInContainer', () => {
  it('deberia hacer scroll al verso encontrado', () => {
    const verseRefs = new Map<number, HTMLDivElement>()
    const verseElement = document.createElement('div')
    const scrollSpy = vi.fn()
    verseElement.scrollIntoView = scrollSpy
    verseRefs.set(20, verseElement)

    const didScroll = scrollToVerseInContainer(verseRefs, 20)

    expect(didScroll).toBe(true)
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  it('deberia retornar false si no existe el verso en refs', () => {
    const verseRefs = new Map<number, HTMLDivElement>()

    const didScroll = scrollToVerseInContainer(verseRefs, 20)

    expect(didScroll).toBe(false)
  })
})
