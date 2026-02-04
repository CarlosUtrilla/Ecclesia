import React from 'react'
import { Folder, Trash2, Edit, Copy, Scissors } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Media } from './types'
import { SelectableItem } from './hooks/useSelection'
import { formatFileSize } from './utils'
import { useMediaServer } from '@/contexts/MediaServerContext'
import { cn } from '@/lib/utils'

interface MediaListProps {
  items: Media[]
  folders: string[]
  onDelete: (media: Media) => void
  onDeleteFolder: (folderName: string) => void
  onNavigateToFolder: (folderName: string) => void
  onCopy: (item: Media | string, isFolder: boolean) => void
  onCut: (item: Media | string, isFolder: boolean) => void
  onRename: (item: Media | string, isFolder: boolean, currentName: string) => void
  onItemClick: (item: SelectableItem, e: React.MouseEvent) => void
  isSelected: (item: SelectableItem) => boolean
}

export function MediaList({
  items,
  folders,
  onDelete,
  onDeleteFolder,
  onNavigateToFolder,
  onCopy,
  onCut,
  onRename,
  onItemClick,
  isSelected
}: MediaListProps) {
  const { buildMediaUrl } = useMediaServer()
  if (folders.length === 0 && items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">No hay medios disponibles</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Arrastra archivos aquí o usa el botón &quot;Importar Medios&quot; para comenzar
        </p>
      </div>
    )
  }

  const allItems: SelectableItem[] = [...folders, ...items]

  return (
    <div className="overflow-hidden">
      {/* Lista */}
      <div>
        {allItems.map((item) => {
          const isFolder = typeof item === 'string'
          const selected = isSelected(item)
          const filePath = isFolder ? '' : item.thumbnail || item.filePath
          const mediaUrl = buildMediaUrl(filePath)

          return (
            <ContextMenu key={isFolder ? `folder:${item}` : `file:${item.id}`}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    'flex items-center h-12 gap-3 px-3 py-2 group',
                    'hover:bg-accent/50 cursor-pointer transition-all duration-200',
                    'border-l-2 border-transparent hover:border-accent/50',
                    {
                      'bg-primary/10 border-primary shadow-md ring-1 ring-primary/20 hover:bg-primary/15':
                        selected
                    }
                  )}
                  onClick={(e) => onItemClick(item, e)}
                  onDoubleClick={() => {
                    if (isFolder) {
                      onNavigateToFolder(item)
                    }
                  }}
                >
                  {/* Icono */}
                  <div className="flex items-center justify-center flex-shrink-0">
                    {isFolder ? (
                      <div className="relative">
                        <Folder
                          className={cn(
                            'h-8 w-8 transition-colors duration-200',
                            selected ? 'text-primary' : 'text-primary/80 group-hover:text-primary'
                          )}
                          fill="currentColor"
                          fillOpacity={selected ? 0.2 : 0.1}
                        />
                      </div>
                    ) : (
                      <img
                        className={cn('max-h-10 max-w-10 rounded transition-all duration-200', {
                          'ring-2 ring-primary/30 shadow-sm': selected
                        })}
                        src={mediaUrl}
                      />
                    )}
                  </div>

                  {/* Nombre */}
                  <div className="flex flex-1 items-center min-w-0">
                    <span
                      className={cn('truncate font-medium transition-colors duration-200', {
                        'text-primary font-semibold': selected
                      })}
                    >
                      {isFolder ? item : item.name}
                    </span>
                  </div>

                  {/* Tamaño */}
                  <div className="flex items-center text-sm text-muted-foreground">
                    {isFolder ? '-' : formatFileSize(item.fileSize)}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {isFolder ? (
                  <>
                    <ContextMenuItem onClick={() => onNavigateToFolder(item)}>
                      <Folder className="h-4 w-4" />
                      Abrir
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onRename(item, true, item)}>
                      <Edit className="h-4 w-4" />
                      Renombrar
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onCopy(item, true)}>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onCut(item, true)}>
                      <Scissors className="h-4 w-4" />
                      Cortar
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => onDeleteFolder(item)}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </ContextMenuItem>
                  </>
                ) : (
                  <>
                    <ContextMenuItem onClick={() => onRename(item, false, item.name)}>
                      <Edit className="h-4 w-4" />
                      Renombrar
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onCopy(item, false)}>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onCut(item, false)}>
                      <Scissors className="h-4 w-4" />
                      Cortar
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => onDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
    </div>
  )
}
