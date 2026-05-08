import { ClipboardPaste } from 'lucide-react'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { MediaGrid } from './MediaGrid'
import { Media } from './types'
import { SelectableItem } from './hooks/useSelection'
import { cn } from '@/lib/utils'

interface MediaGridWrapperProps {
  items: Media[]
  folders: string[]
  currentFolder: string | null
  onDelete: (media: Media) => void
  onDeleteFolder: (folderName: string) => void
  onNavigateToFolder: (folderName: string) => void
  onCopy: (item: Media | string, isFolder: boolean) => void
  onCut: (item: Media | string, isFolder: boolean) => void
  onPaste: () => void
  onDrop: (
    droppedItem: { item: Media | string; isFolder: boolean },
    targetFolder: string | null
  ) => void
  onRename: (item: Media | string, isFolder: boolean, currentName: string) => void
  formatFileSize: (bytes: number) => string
  onItemClick: (item: SelectableItem, e: React.MouseEvent) => void
  isSelected: (item: SelectableItem) => boolean
  onClearSelection: () => void
}

export function MediaGridWrapper({
  onPaste,
  onDrop,
  currentFolder,
  onItemClick,
  isSelected,
  onClearSelection,
  ...gridProps
}: MediaGridWrapperProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    try {
      const dataString = e.dataTransfer.getData('application/json')
      if (!dataString) {
        return
      }

      const data = JSON.parse(dataString)
      if (!data.item || typeof data.isFolder !== 'boolean') {
        return
      }

      onDrop(data, currentFolder)
    } catch {
      return
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Click en el fondo limpia la selección
    if (e.target === e.currentTarget) {
      onClearSelection()
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex-1">
        <div
          className={cn('h-full outline-none', {
            'ring-2 ring-primary ring-inset': isDragOver
          })}
          role="region"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick(e as any)
            }
          }}
          tabIndex={0}
        >
          <MediaGrid
            currentFolder={currentFolder}
            onItemClick={onItemClick}
            isSelected={isSelected}
            {...gridProps}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onPaste}>
          <ClipboardPaste className="h-4 w-4" />
          Pegar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
