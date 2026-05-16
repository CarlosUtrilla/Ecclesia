/**
 * Utilidades para manejar selección de texto y aplicar estilos a porciones de texto
 */

let lastSavedSelection: Range | null = null
let activeEditableElement: HTMLDivElement | null = null

type ToggleValue = 'normal' | 'bold'
type ItalicValue = 'normal' | 'italic'
type UnderlineValue = 'none' | 'underline'

export type SelectionStyleState = {
  fontWeight: ToggleValue | null
  fontStyle: ItalicValue | null
  textDecoration: UnderlineValue | null
  color: string | null
  fontFamily: string | null
  fontSize: number | null
  mixed: {
    fontWeight: boolean
    fontStyle: boolean
    textDecoration: boolean
    color: boolean
    fontFamily: boolean
    fontSize: boolean
  }
}

/** Registra el contenteditable activo para poder enfocarlo al aplicar estilos */
export const registerActiveEditable = (element: HTMLDivElement | null) => {
  activeEditableElement = element
}

export const getActiveEditableElement = (): HTMLDivElement | null => activeEditableElement

const getCurrentRange = (): Range | null => {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return null
  return selection.getRangeAt(0)
}

const normalizeFontWeight = (value: string): ToggleValue => {
  if (value === 'bold') return 'bold'
  const numeric = Number.parseInt(value, 10)
  if (Number.isFinite(numeric) && numeric >= 600) return 'bold'
  return 'normal'
}

const normalizeFontStyle = (value: string): ItalicValue => {
  const lower = value.toLowerCase()
  return lower.includes('italic') || lower.includes('oblique') ? 'italic' : 'normal'
}

const normalizeTextDecoration = (value: string): UnderlineValue => {
  const lower = value.toLowerCase()
  return lower.includes('underline') ? 'underline' : 'none'
}

const parsePx = (value: string): number | null => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const componentToHex = (value: number): string => value.toString(16).padStart(2, '0')

const normalizeColorToHex = (value: string): string => {
  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgbMatch) {
    const r = Number.parseInt(rgbMatch[1], 10)
    const g = Number.parseInt(rgbMatch[2], 10)
    const b = Number.parseInt(rgbMatch[3], 10)
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
    }
  }

  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value.toLowerCase()

  // Fallback para colores nombrados (ej: "red")
  const probe = document.createElement('span')
  probe.style.color = value
  document.body.appendChild(probe)
  const computed = window.getComputedStyle(probe).color
  probe.remove()
  const computedMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (computedMatch) {
    const r = Number.parseInt(computedMatch[1], 10)
    const g = Number.parseInt(computedMatch[2], 10)
    const b = Number.parseInt(computedMatch[3], 10)
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
  }

  return '#ffffff'
}

const collectSelectedTextNodes = (range: Range, root: HTMLElement): Text[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  let current = walker.nextNode()
  while (current) {
    const textNode = current as Text
    const textValue = textNode.nodeValue ?? ''
    if (textValue.trim().length > 0 && range.intersectsNode(textNode)) {
      nodes.push(textNode)
    }
    current = walker.nextNode()
  }

  return nodes
}

export const getSelectionStyleState = (): SelectionStyleState | null => {
  const range = getCurrentRange() ?? lastSavedSelection
  const root = activeEditableElement
  if (!range || !root || !root.isConnected) return null

  const textNodes = range.collapsed
    ? []
    : collectSelectedTextNodes(range, root).filter((node) => root.contains(node))

  const elementsToInspect: HTMLElement[] =
    textNodes.length > 0
      ? textNodes
          .map((node) => node.parentElement)
          .filter((node): node is HTMLElement => node !== null)
      : (() => {
          const common = range.commonAncestorContainer
          if (common.nodeType === Node.TEXT_NODE) {
            return common.parentElement ? [common.parentElement] : []
          }
          return common instanceof HTMLElement ? [common] : []
        })()

  const scopedElements = elementsToInspect
    .map((element) =>
      root.contains(element) ? element : element.closest('[contenteditable="true"]')
    )
    .filter((element): element is HTMLElement => element !== null)

  if (scopedElements.length === 0) return null

  const styles = scopedElements.map((element) => window.getComputedStyle(element))

  const fontWeights = styles.map((s) => normalizeFontWeight(s.fontWeight))
  const fontStyles = styles.map((s) => normalizeFontStyle(s.fontStyle))
  const textDecorations = styles.map((s) =>
    normalizeTextDecoration(s.textDecorationLine || s.textDecoration)
  )
  const colors = styles.map((s) => normalizeColorToHex(s.color))
  const fontFamilies = styles.map((s) => s.fontFamily)
  const fontSizes = styles.map((s) => parsePx(s.fontSize))

  const getUniform = <T>(values: T[]): { value: T | null; mixed: boolean } => {
    if (values.length === 0) return { value: null, mixed: false }
    const first = values[0]
    const mixed = values.some((value) => value !== first)
    return { value: mixed ? null : first, mixed }
  }

  const fw = getUniform(fontWeights)
  const fs = getUniform(fontStyles)
  const td = getUniform(textDecorations)
  const color = getUniform(colors)
  const family = getUniform(fontFamilies)
  const size = getUniform(fontSizes)

  return {
    fontWeight: fw.value,
    fontStyle: fs.value,
    textDecoration: td.value,
    color: color.value,
    fontFamily: family.value,
    fontSize: size.value,
    mixed: {
      fontWeight: fw.mixed,
      fontStyle: fs.mixed,
      textDecoration: td.mixed,
      color: color.mixed,
      fontFamily: family.mixed,
      fontSize: size.mixed
    }
  }
}

const getPreferredNonCollapsedRange = (): Range | null => {
  const currentRange = getCurrentRange()
  if (currentRange && !currentRange.collapsed) return currentRange
  if (lastSavedSelection && !lastSavedSelection.collapsed) return lastSavedSelection
  return null
}

export const hasActiveSelection = (): boolean => {
  return getPreferredNonCollapsedRange() !== null
}

export const applyStylesToTextSelection = (styles: Record<string, unknown>): boolean => {
  const range = getPreferredNonCollapsedRange()
  if (!range) return false

  // Convertir objeto de estilos a propiedades CSS inline en un elemento
  const applyInlineStyles = (element: HTMLElement) => {
    Object.entries(styles).forEach(([cssKey, value]) => {
      if (value !== undefined && value !== null) {
        const cssProperty = cssKey.replace(/([A-Z])/g, '-$1').toLowerCase()
        let cssValue = String(value)
        if (
          typeof value === 'number' &&
          ['fontSize', 'letterSpacing', 'lineHeight', 'borderWidth'].includes(cssKey)
        ) {
          cssValue = `${value}px`
        }
        element.style.setProperty(cssProperty, cssValue)
      }
    })
  }

  // Actualiza la selección guardada al nuevo rango.
  // Solo sincroniza selección DOM cuando el editor mantiene foco;
  // así evitamos interferir con popovers del inspector (color picker).
  const updateSelectionTo = (element: HTMLElement) => {
    const newRange = document.createRange()
    newRange.selectNodeContents(element)
    const shouldSyncDomSelection =
      activeEditableElement !== null && document.activeElement === activeEditableElement

    if (shouldSyncDomSelection) {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    }
    lastSavedSelection = newRange.cloneRange()
  }

  try {
    const workingRange = range.cloneRange()

    // Caso: la selección está completamente dentro de un <span> con estilos inline
    // → actualizar ese span directamente en lugar de crear uno nuevo (evita anidamiento)
    const commonAncestor = workingRange.commonAncestorContainer
    const parentElement =
      commonAncestor.nodeType === Node.TEXT_NODE
        ? (commonAncestor.parentElement as HTMLElement | null)
        : (commonAncestor as HTMLElement | null)

    if (
      parentElement &&
      parentElement.nodeName === 'SPAN' &&
      parentElement.getAttribute('style') !== null &&
      workingRange.toString() === parentElement.textContent
    ) {
      applyInlineStyles(parentElement)
      updateSelectionTo(parentElement)
      return true
    }

    // Caso general: envolver el contenido seleccionado en un nuevo <span>
    const span = document.createElement('span')
    applyInlineStyles(span)
    const contents = workingRange.extractContents()
    span.appendChild(contents)
    workingRange.insertNode(span)
    updateSelectionTo(span)
    return true
  } catch (error) {
    console.error('Error applying styles to selection:', error)
    return false
  }
}

export const saveSelection = (): Range | null => {
  const range = getCurrentRange()
  lastSavedSelection = range ? range.cloneRange() : null
  return lastSavedSelection
}

export const restoreSelection = (range: Range | null) => {
  if (!range) return
  const selection = window.getSelection()
  if (!selection) return
  try {
    selection.removeAllRanges()
    selection.addRange(range)
    lastSavedSelection = range.cloneRange()
  } catch (error) {
    console.error('Error restoring selection:', error)
  }
}
