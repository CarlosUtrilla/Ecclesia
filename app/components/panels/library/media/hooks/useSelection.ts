import { useState, useCallback } from 'react'
import { Media } from '../types'

export type SelectableItem = Media | string

export function useSelection() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [anchorId, setAnchorId] = useState<string | null>(null)

  // Generar ID único para un item
  const getItemId = (item: SelectableItem): string => {
    return typeof item === 'string' ? `folder:${item}` : `file:${item.id}`
  }

  // Seleccionar un solo item
  const selectSingle = useCallback((item: SelectableItem) => {
    const id = getItemId(item)
    setSelectedItems(new Set([id]))
    setLastSelectedId(id)
    setAnchorId(id)
  }, [])

  // Toggle selección (Ctrl+Click)
  const toggleSelect = useCallback((item: SelectableItem) => {
    const id = getItemId(item)
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
    setLastSelectedId(id)
    setAnchorId(id)
  }, [])

  // Selección por rango (Shift+Click)
  const selectRange = useCallback(
    (item: SelectableItem, allItems: SelectableItem[]) => {
      const id = getItemId(item)

      if (!anchorId) {
        selectSingle(item)
        return
      }

      const allIds = allItems.map(getItemId)
      const currentIndex = allIds.indexOf(id)
      const anchorIndex = allIds.indexOf(anchorId)

      if (currentIndex === -1 || anchorIndex === -1) return

      const start = Math.min(currentIndex, anchorIndex)
      const end = Math.max(currentIndex, anchorIndex)
      const rangeIds = allIds.slice(start, end + 1)

      setSelectedItems(new Set(rangeIds))
      setLastSelectedId(id)
      // No cambiar anchorId para que Shift+Click adicionales usen el mismo punto de anclaje
    },
    [anchorId, selectSingle]
  )

  // Seleccionar todos
  const selectAll = useCallback((items: SelectableItem[]) => {
    const allIds = items.map(getItemId)
    setSelectedItems(new Set(allIds))
    setLastSelectedId(allIds[allIds.length - 1] || null)
    setAnchorId(allIds[0] || null)
  }, [])

  // Limpiar selección
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
    setLastSelectedId(null)
    setAnchorId(null)
  }, [])

  // Verificar si un item está seleccionado
  const isSelected = useCallback(
    (item: SelectableItem): boolean => {
      return selectedItems.has(getItemId(item))
    },
    [selectedItems]
  )

  const getSelectedItems = useCallback(
    (allItems: SelectableItem[]): SelectableItem[] => {
      return allItems.filter((item) => isSelected(item))
    },
    [isSelected]
  )

  const navigateSelection = useCallback(
    (
      direction: 'up' | 'down' | 'left' | 'right',
      allItems: SelectableItem[],
      columnsPerRow: number = 2,
      extendSelection: boolean = false
    ) => {
      if (allItems.length === 0) return

      const allIds = allItems.map(getItemId)
      const currentIndex = lastSelectedId ? allIds.indexOf(lastSelectedId) : -1

      // Si no hay selección, empezar desde el principio
      if (currentIndex === -1) {
        selectSingle(allItems[0])
        return
      }

      let newIndex = currentIndex

      switch (direction) {
        case 'up':
          newIndex = Math.max(0, currentIndex - columnsPerRow)
          break
        case 'down':
          newIndex = Math.min(allItems.length - 1, currentIndex + columnsPerRow)
          break
        case 'left':
          newIndex = Math.max(0, currentIndex - 1)
          break
        case 'right':
          newIndex = Math.min(allItems.length - 1, currentIndex + 1)
          break
      }

      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < allItems.length) {
        if (extendSelection) {
          // Shift+Flecha: extender selección
          selectRange(allItems[newIndex], allItems)
        } else {
          // Flecha sola: mover selección
          selectSingle(allItems[newIndex])
        }
      }
    },
    [lastSelectedId, selectSingle, selectRange]
  )

  return {
    selectedItems,
    selectSingle,
    toggleSelect,
    selectRange,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedItems,
    navigateSelection,
    getItemId,
    hasSelection: selectedItems.size > 0,
    selectionCount: selectedItems.size
  }
}
