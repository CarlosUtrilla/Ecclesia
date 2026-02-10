import { Folder, FolderPlus, Trash2, Edit, Copy, Scissors } from 'lucide-react'
import { useState, useRef } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/ui/context-menu'
import { Media } from './types'
import { SelectableItem } from './hooks/useSelection'
import { cn } from '@/lib/utils'
import { useDraggable } from '@dnd-kit/core'

interface FolderCardProps {
  folderName: string
  currentFolder: string | null
  onNavigate: (folderName: string) => void
  onDelete: (folderName: string) => void
  onCopy: (item: string, isFolder: boolean) => void
  onCut: (item: string, isFolder: boolean) => void
  onRename: (item: string, isFolder: boolean, currentName: string) => void
  onDrop: (
    droppedItem: { item: Media | string; isFolder: boolean },
    targetFolder: string | null
  ) => void
  onClick?: (item: SelectableItem, e: React.MouseEvent) => void
  isSelected?: boolean
}

export function FolderCard({
  folderName,
  currentFolder,
  onNavigate,
  onDelete,
  onCopy,
  onCut,
  onRename,
  onDrop,
  onClick,
  isSelected = false
}: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const clickTimeout = useRef<NodeJS.Timeout | null>(null)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `folder-${folderName}`,
    data: {
      item: folderName,
      isFolder: true
    }
  })

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
        // No hay datos válidos, ignorar silenciosamente
        return
      }

      const data = JSON.parse(dataString)
      if (!data.item || typeof data.isFolder !== 'boolean') {
        // Datos inválidos, ignorar silenciosamente
        return
      }

      const targetFolder = currentFolder ? `${currentFolder}/${folderName}` : folderName
      onDrop(data, targetFolder)
    } catch (error) {
      // Error al parsear JSON, ignorar silenciosamente
      console.log(error)
      return
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!onClick) return

    // Si es doble click, cancelar el timeout del click simple
    if (e.detail === 2) {
      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current)
        clickTimeout.current = null
      }
      return
    }

    // Para click simple, esperar un poco para ver si es doble click
    // Si hay modificadores (Shift, Ctrl), ejecutar inmediatamente sin delay
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      onClick(folderName, e)
    } else {
      // Reducir el delay a 150ms para una respuesta más rápida
      clickTimeout.current = setTimeout(() => {
        onClick(folderName, e)
        clickTimeout.current = null
      }, 150)
    }
  }

  const handleDoubleClick = () => {
    // Cancelar cualquier click simple pendiente
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current)
      clickTimeout.current = null
    }
    onNavigate(folderName)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={cn(
            'group relative border border-border/50 rounded-lg overflow-hidden',
            'bg-card/30 backdrop-blur-sm hover:bg-card/60 transition-all duration-200',
            'hover:shadow-lg hover:shadow-black/5 hover:border-border',
            'hover:-translate-y-0.5 cursor-pointer w-32 aspect-square',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            {
              'ring-2 ring-primary bg-primary/10 border-primary shadow-md shadow-primary/20':
                isDragOver,
              'ring-2 ring-accent border-accent shadow-md shadow-accent/20 bg-accent/5': isSelected,
              'opacity-50 bg-muted': isDragging
            }
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (e.shiftKey) {
                handleDoubleClick()
              } else {
                handleClick(e as any)
              }
            }
          }}
        >
          {/* Preview */}
          <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center relative">
            {/* Decorative background pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-2 left-2 w-1 h-1 bg-primary/20 rounded-full" />
              <div className="absolute top-4 right-3 w-1 h-1 bg-primary/20 rounded-full" />
              <div className="absolute bottom-3 left-3 w-1 h-1 bg-primary/20 rounded-full" />
            </div>
            <Folder
              className="h-10 w-10 text-primary group-hover:text-primary/80 transition-colors duration-200 drop-shadow-sm"
              fill="currentColor"
              fillOpacity={0.1}
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-200 rounded-md" />
          </div>

          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-card/90 backdrop-blur-md border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <p className="text-xs font-medium text-foreground truncate flex-1" title={folderName}>
                {folderName}
              </p>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onNavigate(folderName)}>
          <FolderPlus className="h-4 w-4" />
          Abrir
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRename(folderName, true, folderName)}>
          <Edit className="h-4 w-4" />
          Renombrar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopy(folderName, true)}>
          <Copy className="h-4 w-4" />
          Copiar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCut(folderName, true)}>
          <Scissors className="h-4 w-4" />
          Cortar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onDelete(folderName)}>
          <Trash2 className="h-4 w-4" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
