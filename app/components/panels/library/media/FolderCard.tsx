import { Folder, FolderPlus, Trash2, Edit, Copy, Scissors } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/ui/context-menu'

interface FolderCardProps {
  folderName: string
  onNavigate: (folderName: string) => void
  onDelete: (folderName: string) => void
  onCopy: (item: string, isFolder: boolean) => void
  onCut: (item: string, isFolder: boolean) => void
  onRename: (item: string, isFolder: boolean, currentName: string) => void
}

export function FolderCard({
  folderName,
  onNavigate,
  onDelete,
  onCopy,
  onCut,
  onRename
}: FolderCardProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:shadow-md transition-shadow cursor-pointer"
          onDoubleClick={() => onNavigate(folderName)}
        >
          {/* Preview */}
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Folder className="h-12 w-12 text-primary" />
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
