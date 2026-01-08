import { MediaCard } from './MediaCard'
import { FolderCard } from './FolderCard'
import { Media } from './types'
import { SelectableItem } from './hooks/useSelection'

interface MediaGridProps {
  items: Media[]
  folders: string[]
  currentFolder: string | null
  onDelete: (media: Media) => void
  onDeleteFolder: (folderName: string) => void
  onNavigateToFolder: (folderName: string) => void
  onCopy: (item: Media | string, isFolder: boolean) => void
  onCut: (item: Media | string, isFolder: boolean) => void
  onRename: (item: Media | string, isFolder: boolean, currentName: string) => void
  onDrop: (
    droppedItem: { item: Media | string; isFolder: boolean },
    targetFolder: string | null
  ) => void
  formatFileSize: (bytes: number) => string
  onItemClick: (item: SelectableItem, e: React.MouseEvent) => void
  isSelected: (item: SelectableItem) => boolean
}

export function MediaGrid({
  items,
  folders,
  currentFolder,
  onDelete,
  onDeleteFolder,
  onNavigateToFolder,
  onCopy,
  onCut,
  onRename,
  onDrop,
  formatFileSize,
  onItemClick,
  isSelected
}: MediaGridProps) {
  if (folders.length === 0 && items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No hay medios disponibles</p>
        <p className="text-sm mt-1">Importa imágenes o videos para comenzar</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 auto-rows-min">
      {/* Carpetas */}
      {folders.map((folderName) => (
        <FolderCard
          key={folderName}
          folderName={folderName}
          currentFolder={currentFolder}
          onNavigate={onNavigateToFolder}
          onDelete={onDeleteFolder}
          onCopy={onCopy}
          onCut={onCut}
          onRename={onRename}
          onDrop={onDrop}
          onClick={onItemClick}
          isSelected={isSelected(folderName)}
        />
      ))}

      {/* Archivos */}
      {items.map((media) => (
        <MediaCard
          key={media.id}
          media={media}
          onDelete={onDelete}
          onCopy={onCopy}
          onCut={onCut}
          onRename={onRename}
          formatFileSize={formatFileSize}
          onClick={onItemClick}
          isSelected={isSelected(media)}
        />
      ))}
    </div>
  )
}
