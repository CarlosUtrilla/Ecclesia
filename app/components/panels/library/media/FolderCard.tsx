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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({ item: folderName, isFolder: true }))
  }

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
    // Si hay modificadores (Shift, Ctrl), ejecutar inmediatamente
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      onClick(folderName, e)
    } else {
      clickTimeout.current = setTimeout(() => {
        onClick(folderName, e)
        clickTimeout.current = null
      }, 200)
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
          className={`group relative border rounded-lg overflow-hidden bg-muted/30 hover:shadow-md transition-shadow cursor-pointer ${
            isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''
          } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-white' : ''}`}
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {/* Preview */}
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Folder className="h-12 w-12 text-primary fill-primary" />
          </div>

          {/* Info */}
          <div className="flex items-center gap-1 p-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium truncate" title={folderName}>
              {folderName}
            </p>
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
