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
      <div className="text-center py-12 text-muted-foreground">
        <p>No hay medios disponibles</p>
        <p className="text-sm mt-1">Importa imágenes o videos para comenzar</p>
      </div>
    )
  }

  const allItems: SelectableItem[] = [...folders, ...items]

  return (
    <div className="overflow-hidden">
      {/* Lista */}
      <div className="divide-y">
        {allItems.map((item) => {
          const isFolder = typeof item === 'string'
          const selected = isSelected(item)
          const filePath = isFolder ? '' : item.thumbnail || item.filePath
          const mediaUrl = buildMediaUrl(filePath)

          return (
            <ContextMenu key={isFolder ? `folder:${item}` : `file:${item.id}`}>
              <ContextMenuTrigger asChild>
                <div
                  className={`flex items-center h-11 gap-4 px-2 py-1 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selected ? 'bg-blue-100 ' : ''
                  }`}
                  onClick={(e) => onItemClick(item, e)}
                  onDoubleClick={() => {
                    if (isFolder) {
                      onNavigateToFolder(item)
                    }
                  }}
                >
                  {/* Icono */}
                  <div className="flex items-center justify-center">
                    {isFolder ? (
                      <Folder className="h-8 w-10 text-primary fill-primary" />
                    ) : (
                      <img className="max-h-10 max-w-10" src={mediaUrl} />
                    )}
                  </div>

                  {/* Nombre */}
                  <div className="flex flex-1 items-center min-w-0">
                    <span className="truncate font-medium">{isFolder ? item : item.name}</span>
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
