import React from 'react'
import { Image, Video, Trash2, Edit, Copy, Scissors } from 'lucide-react'
import { Button } from '@/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Media } from './types'
import { SelectableItem } from './hooks/useSelection'
import { useMediaServer } from '@/contexts/MediaServerContext'

interface MediaCardProps {
  media: Media
  onDelete: (media: Media) => void
  onCopy: (item: Media, isFolder: boolean) => void
  onCut: (item: Media, isFolder: boolean) => void
  onRename: (item: Media, isFolder: boolean, currentName: string) => void
  formatFileSize: (bytes: number) => string
  onClick?: (item: SelectableItem, e: React.MouseEvent) => void
  isSelected?: boolean
}

export function MediaCard({
  media,
  onDelete,
  onCopy,
  onCut,
  onRename,
  onClick,
  isSelected = false
}: MediaCardProps) {
  const { buildMediaUrl } = useMediaServer()
  const filePath = media.thumbnail || media.filePath
  const mediaUrl = buildMediaUrl(filePath)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({ item: media, isFolder: false }))
  }

  const handleClick = (e: React.MouseEvent) => {
    // Prevenir clicks en el botón de eliminar
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onClick?.(media, e)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={`group relative border rounded-lg overflow-hidden bg-muted/30 hover:shadow-md transition-shadow cursor-pointer ${
            isSelected ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-950 dark:text-white' : ''
          }`}
          draggable
          onDragStart={handleDragStart}
          onClick={handleClick}
        >
          {/* Preview */}
          <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
            <img src={mediaUrl} alt={media.name} className="w-full h-full object-cover" />
          </div>

          {/* Info */}
          <div className="flex items-center gap-1 p-2">
            <div className="w-4 h-4">
              {media.type === 'IMAGE' ? (
                <Image className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Video className="h-4 w-4 aspect-square text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium truncate" title={media.name}>
              {media.name}
            </p>
          </div>

          {/* Actions */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onDelete(media)}
              title="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onRename(media, false, media.name)}>
          <Edit className="h-4 w-4" />
          Renombrar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopy(media, false)}>
          <Copy className="h-4 w-4" />
          Copiar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCut(media, false)}>
          <Scissors className="h-4 w-4" />
          Cortar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onDelete(media)}>
          <Trash2 className="h-4 w-4" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
