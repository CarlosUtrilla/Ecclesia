import { useState } from 'react'
import { Media } from '../types'
import { SelectableItem } from './useSelection'

interface ClipboardData {
  type: 'copy' | 'cut'
  items: Array<{
    item: Media | string
    isFolder: boolean
    sourceFolder: string | null
  }>
}

export function useClipboard(currentFolder: string | null) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)

  const getSourceFolder = (item: Media | string) =>
    typeof item === 'string' ? currentFolder : (item.folder ?? null)

  const copy = (items: SelectableItem[]) => {
    setClipboard({
      type: 'copy',
      items: items.map((item) => ({
        item,
        isFolder: typeof item === 'string',
        sourceFolder: getSourceFolder(item)
      }))
    })
  }

  const cut = (items: SelectableItem[]) => {
    setClipboard({
      type: 'cut',
      items: items.map((item) => ({
        item,
        isFolder: typeof item === 'string',
        sourceFolder: getSourceFolder(item)
      }))
    })
  }

  const clear = () => setClipboard(null)

  const getSourcePath = (item: Media | string, sourceFolder: string | null): string => {
    if (typeof item === 'string') {
      return sourceFolder ? `${sourceFolder}/${item}` : item
    }
    const filePath = item.filePath
    return filePath.startsWith('files/') ? filePath.substring(6) : filePath
  }

  return {
    clipboard,
    copy,
    cut,
    clear,
    getSourcePath,
    hasClipboard: clipboard !== null,
    clipboardCount: clipboard?.items.length ?? 0
  }
}
