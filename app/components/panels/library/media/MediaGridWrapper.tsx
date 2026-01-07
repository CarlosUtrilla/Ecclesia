import { ClipboardPaste } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { MediaGrid } from './MediaGrid'
import { Media } from '@prisma/client'

interface MediaGridWrapperProps {
  items: Media[]
  folders: string[]
  onDelete: (media: Media) => void
  onDeleteFolder: (folderName: string) => void
  onNavigateToFolder: (folderName: string) => void
  onCopy: (item: Media | string, isFolder: boolean) => void
  onCut: (item: Media | string, isFolder: boolean) => void
  onPaste: () => void
  onRename: (item: Media | string, isFolder: boolean, currentName: string) => void
  formatFileSize: (bytes: number) => string
}

export function MediaGridWrapper({ onPaste, ...gridProps }: MediaGridWrapperProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="min-h-[200px]">
        <MediaGrid {...gridProps} />
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
