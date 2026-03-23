// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  applyStylesToTextSelection,
  getSelectionStyleState,
  hasActiveSelection,
  registerActiveEditable,
  saveSelection,
  restoreSelection
} from './textSelection'

const selectWord = (element: HTMLElement, startOffset: number, endOffset: number) => {
  const textNode = element.firstChild
  if (!textNode) throw new Error('No text node found')

  const range = document.createRange()
  range.setStart(textNode, startOffset)
  range.setEnd(textNode, endOffset)

  const selection = window.getSelection()
  if (!selection) throw new Error('No selection available')

  selection.removeAllRanges()
  selection.addRange(range)
}

describe('textSelection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    const selection = window.getSelection()
    selection?.removeAllRanges()
    registerActiveEditable(null)
  })

  it('deberia detectar cuando existe una seleccion activa', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.textContent = 'Hola mundo'
    document.body.appendChild(element)

    selectWord(element, 0, 4)

    expect(hasActiveSelection()).toBe(true)
  })

  it('deberia aplicar estilos inline a la seleccion actual', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.textContent = 'Hola mundo'
    document.body.appendChild(element)

    selectWord(element, 0, 4)

    const applied = applyStylesToTextSelection({ color: '#ff0000', fontSize: 42 })

    expect(applied).toBe(true)
    expect(element.innerHTML).toContain('span')
    expect(element.innerHTML).toContain('color: rgb(255, 0, 0)')
    expect(element.innerHTML).toContain('font-size: 42px')
  })

  it('deberia reutilizar la seleccion guardada si el foco se pierde antes de aplicar', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.textContent = 'Hola mundo'
    document.body.appendChild(element)
    registerActiveEditable(element as HTMLDivElement)

    selectWord(element, 5, 10)
    saveSelection()

    // Simula pérdida de foco (clic en inspector)
    const selection = window.getSelection()
    selection?.removeAllRanges()

    // Aplica estilo usando la selección guardada
    const applied = applyStylesToTextSelection({ fontWeight: 'bold' })

    expect(applied).toBe(true)
    expect(element.innerHTML).toContain('font-weight: bold')
    // Si el foco no está en el editor, no sincroniza selección DOM
    expect(selection?.rangeCount ?? 0).toBe(0)
    // Después de aplicar, la selección debe seguir activa (cubre el span recién creado)
    expect(hasActiveSelection()).toBe(true)
  })

  it('deberia restaurar la seleccion guardada si no se ha aplicado ningun estilo', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.textContent = 'Hola mundo'
    document.body.appendChild(element)

    selectWord(element, 5, 10)
    const saved = saveSelection()

    // Limpiar la selección del DOM (la selección guardada en lastSavedSelection sigue existiendo)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    // La selección activa del DOM ya no tiene rangos
    expect(sel?.rangeCount ?? 0).toBe(0)

    restoreSelection(saved)
    // Tras restaurar, la selección del DOM tiene un rango no colapsado
    expect(hasActiveSelection()).toBe(true)
  })

  it('deberia priorizar la seleccion guardada si la seleccion actual esta colapsada', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.textContent = 'Hola mundo'
    document.body.appendChild(element)

    // Guardar una selección válida
    selectWord(element, 0, 4)
    saveSelection()

    // Simular selección actual colapsada en otro nodo (como un control del inspector)
    const collapsedRange = document.createRange()
    collapsedRange.setStart(element.firstChild as Text, 0)
    collapsedRange.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(collapsedRange)

    const applied = applyStylesToTextSelection({ fontWeight: 'bold' })

    expect(applied).toBe(true)
    expect(element.innerHTML).toContain('font-weight: bold')
  })

  it('deberia reflejar estilos uniformes de la seleccion para la toolbar', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<span style="font-weight: bold; color: rgb(255, 0, 0)">Hola</span> mundo'
    document.body.appendChild(element)
    registerActiveEditable(element as HTMLDivElement)

    const textNode = element.querySelector('span')?.firstChild
    if (!textNode) throw new Error('No text node found in span')

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 4)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const state = getSelectionStyleState()
    expect(state).not.toBeNull()
    expect(state?.fontWeight).toBe('bold')
    expect(state?.color).toBe('#ff0000')
    expect(state?.mixed.fontWeight).toBe(false)
    expect(state?.mixed.color).toBe(false)
  })

  it('deberia marcar estilo mixto cuando la seleccion combina formatos distintos', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<span style="font-weight: bold">Ho</span><span>la</span>'
    document.body.appendChild(element)
    registerActiveEditable(element as HTMLDivElement)

    const first = element.querySelector('span')?.firstChild
    const second = element.querySelectorAll('span')[1]?.firstChild
    if (!first || !second) throw new Error('No text nodes found')

    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(second, 2)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const state = getSelectionStyleState()
    expect(state).not.toBeNull()
    expect(state?.fontWeight).toBeNull()
    expect(state?.mixed.fontWeight).toBe(true)
  })
})
