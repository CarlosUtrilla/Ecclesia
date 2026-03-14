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
  formatFileSize,
  onItemClick,
  isSelected
}: MediaGridProps) {
  if (folders.length === 0 && items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
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

  return (
    <div className="flex flex-wrap gap-3 content-start p-2">
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
