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
import { cn } from '@/lib/utils'
import { useDraggable } from '@dnd-kit/core'

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

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `media-${media.id}`,
    data: {
      type: 'MEDIA',
      accessData: media.id
    }
  })

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
          ref={setNodeRef}
          role="button"
          className={cn(
            'group relative border border-border/50 rounded-lg overflow-hidden',
            'bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-200',
            'hover:shadow-lg hover:shadow-black/5 hover:border-border',
            'hover:-translate-y-0.5 cursor-pointer w-32 aspect-square',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            {
              'ring-2 ring-primary border-primary shadow-md shadow-primary/20': isSelected,
              'opacity-50 bg-muted': isDragging
            }
          )}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick(e as any)
            }
          }}
          {...listeners}
          {...attributes}
        >
          {/* Preview */}
          <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
            <img
              src={mediaUrl}
              alt={media.name}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              width={128}
              height={128}
              loading="lazy"
            />
            {/* Overlay sutil en hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />

            {/* Info */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 p-2',
                'bg-gradient-to-t from-black/80 to-transparent',
                'backdrop-blur-sm border-t border-white/10',
                'transform translate-y-full group-hover:translate-y-0',
                'transition-transform duration-200 ease-out',
                {
                  'transform translate-y-0': isSelected
                }
              )}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 flex-shrink-0">
                  {media.type === 'IMAGE' ? (
                    <Image className="h-3 w-3 text-white/80" />
                  ) : (
                    <Video className="h-3 w-3 text-white/80" />
                  )}
                </div>
                <p className="text-xs font-medium text-white truncate flex-1" title={media.name}>
                  {media.name}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
              <Button
                variant="destructive"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0 rounded-full shadow-lg',
                  'bg-destructive/90 hover:bg-destructive',
                  'backdrop-blur-sm border border-white/20',
                  'focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1'
                )}
                onClick={() => onDelete(media)}
                aria-label={`Eliminar ${media.name}`}
                title="Eliminar"
              >
                <Trash2 className="h-3 w-3 text-white" />
              </Button>
            </div>
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
